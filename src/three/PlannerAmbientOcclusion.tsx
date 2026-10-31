"use client";

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Box3,
  DoubleSide,
  Mesh,
  Texture,
  Vector2,
  Vector3,
  type Material,
  type Object3D,
  type WebGLProgramParametersWithUniforms,
  type WebGLRenderer,
} from "three";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";

const materials = (object: Mesh): Material[] =>
  Array.isArray(object.material) ? object.material : [object.material];

/**
 * Cut-away walls, the shadow-only roof and selection lines draw nothing on
 * screen; they must not occlude what is behind them either.
 */
export function occludesView(object: Object3D) {
  const kind = object as Object3D & {
    isLine?: boolean; isPoints?: boolean; isSprite?: boolean; isLineSegments2?: boolean; isLine2?: boolean;
  };
  if (kind.isLine || kind.isPoints || kind.isSprite) return false;
  // drei <Edges>/<Line> are meshes over a unit quad that only the line shader
  // expands; drawn with the normal material they become a 2 m slab in the depth.
  if (kind.isLineSegments2 || kind.isLine2) return false;
  if (!(object instanceof Mesh)) return true;
  if (object.userData.noAmbientOcclusion) return false;
  // Pick proxies use invisible materials; fading walls stop writing depth.
  return materials(object).some(
    (material) => material.visible && material.colorWrite && material.depthWrite && material.opacity >= 0.5,
  );
}

class PlannerGTAOPass extends GTAOPass {
  private hidden: Object3D[] = [];
  overrideVisibility() {
    this.scene.traverse((object) => {
      if (object.visible && !occludesView(object)) {
        object.visible = false;
        this.hidden.push(object);
      }
    });
  }
  restoreVisibility() {
    this.hidden.forEach((object) => { object.visible = true; });
    this.hidden = [];
  }
}

/**
 * Screen-space occlusion is a visibility term for light arriving from the whole
 * hemisphere, so it belongs on indirect light only. Multiplying the finished
 * image (the stock GTAO blend) also darkened sunlit floor beside furniture,
 * lamp glow, glass and the backdrop. These uniforms are shared by every lit
 * material; `strength` is non-zero only while this component draws the frame,
 * so previews, exports and reflection captures never read a stale AO buffer.
 */
const shared = {
  plannerAoMap: { value: null as Texture | null },
  plannerAoResolution: { value: new Vector2(1, 1) },
  plannerAoStrength: { value: 0 },
};

/** Share of the occlusion applied to direct light: contact cues under a sunlit sofa. */
const DIRECT_SHARE = "0.18";

const declarations = /* glsl */ `
uniform sampler2D plannerAoMap;
uniform vec2 plannerAoResolution;
uniform float plannerAoStrength;
uniform float plannerAoMask;
`;

const apply = /* glsl */ `
#include <aomap_fragment>
{
  float plannerAoAmount = plannerAoStrength * plannerAoMask;
  if ( plannerAoAmount > 0.0 ) {
    float plannerVisibility = mix( 1.0, texture2D( plannerAoMap, gl_FragCoord.xy / plannerAoResolution ).r, plannerAoAmount );
    // Jimenez et al. 2016 multi-bounce fit: light, saturated surfaces get back
    // the inter-reflected light a single-bounce term removes, so white cabinets
    // stay white in corners and a red sofa darkens to a deeper red, not grey.
    vec3 plannerAlbedo = diffuseColor.rgb;
    vec3 plannerA = 2.0404 * plannerAlbedo - 0.3324;
    vec3 plannerB = -4.7951 * plannerAlbedo + 0.6417;
    vec3 plannerC = 2.7552 * plannerAlbedo + 0.6903;
    vec3 plannerBounce = max( vec3( plannerVisibility ),
      ( ( plannerVisibility * plannerA + plannerB ) * plannerVisibility + plannerC ) * plannerVisibility );
    reflectedLight.indirectDiffuse *= plannerBounce;
    reflectedLight.directDiffuse *= mix( vec3( 1.0 ), plannerBounce, ${DIRECT_SHARE} );
    #if defined( STANDARD )
      float plannerNV = saturate( dot( geometryNormal, geometryViewDir ) );
      reflectedLight.indirectSpecular *= computeSpecularOcclusion( plannerNV, plannerVisibility, material.roughness );
    #endif
  }
}
`;

type LitMaterial = Material & {
  isMeshStandardMaterial?: boolean;
  isMeshLambertMaterial?: boolean;
  isMeshPhongMaterial?: boolean;
  transmission?: number;
};

const masks = new WeakMap<Material, { value: number }>();

/**
 * Hooks a material once. The shader variant does not change afterwards: AO on
 * and off is a uniform, so starting a drag never recompiles programs.
 */
function receiveOcclusion(material: LitMaterial) {
  if (masks.has(material)) return masks.get(material)!;
  const mask = { value: 1 };
  masks.set(material, mask);
  const previous = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey;
  material.onBeforeCompile = function (shader: WebGLProgramParametersWithUniforms, renderer: WebGLRenderer) {
    previous.call(this, shader, renderer);
    Object.assign(shader.uniforms, shared, { plannerAoMask: mask });
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${declarations}`)
      .replace("#include <aomap_fragment>", apply);
  };
  material.customProgramCacheKey = function () {
    return `${previousKey.call(this)}|planner-ao`;
  };
  material.needsUpdate = true;
  return mask;
}

/**
 * Glass, fading cut-away walls and other see-through surfaces would sample
 * the occlusion of whatever lies behind them in the depth buffer.
 */
function syncMasks(scene: Object3D) {
  scene.traverse((object) => {
    if (!(object instanceof Mesh) || !object.visible) return;
    for (const material of materials(object) as LitMaterial[]) {
      if (!material.isMeshStandardMaterial && !material.isMeshLambertMaterial && !material.isMeshPhongMaterial) continue;
      const mask = receiveOcclusion(material);
      const seeThrough = material.transparent && material.opacity < 0.98 || (material.transmission ?? 0) > 0;
      mask.value = seeThrough || object.userData.noAmbientOcclusion ? 0 : 1;
    }
  });
}

/**
 * Contact darkening in corners, along skirting, under wall units and between
 * modules: the cue a flat, evenly lit room or kitchen is missing. GTAO runs
 * from its own depth/normal prepass before the beauty render and feeds the
 * lighting of every material directly (see `apply`).
 *
 * Camera motion must stay smooth, with nothing blinking: the pass never turns
 * off or changes its sample pattern while orbiting, and its buffer keeps one
 * size even when the canvas drops resolution during motion. Materials look it
 * up by their own screen position (normalised by the live drawing-buffer size,
 * read every frame), so a DPR change can never shift the occlusion for a frame.
 */
export function PlannerAmbientOcclusion({
  normals = "depth",
  bounds,
  radius = 0.45,
}: {
  /**
   * "depth" rebuilds normals from depth (kitchen catalog GLBs carry inverted
   * vertex normals); "buffer" uses rendered normals, cleaner at silhouettes.
   */
  normals?: "depth" | "buffer";
  /** World box [min, max] in metres; no occlusion is computed outside it. */
  bounds?: [[number, number, number], [number, number, number]];
  /** World-space reach in metres: about a skirting board to a sofa arm. */
  radius?: number;
} = {}) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  // The resting DPR, not the live one RoomMotionResolution lowers while moving.
  const initialDpr = useThree((state) => state.viewport.initialDpr);
  const invalidate = useThree((state) => state.invalidate);
  const ao = useMemo(() => {
    const pass = new PlannerGTAOPass(scene, camera, 1, 1);
    pass.output = GTAOPass.OUTPUT.Off;
    pass.normalMaterial.side = DoubleSide;
    if (normals === "depth")
      for (const material of [pass.gtaoMaterial, pass.pdMaterial]) {
        material.defines.NORMAL_VECTOR_TYPE = 0;
        material.needsUpdate = true;
      }
    return pass;
  }, [scene, camera, normals]);
  useEffect(() => {
    // Thickness keeps thin chair legs and handles from casting a wide halo on
    // the wall far behind them; the exponent concentrates samples near contact.
    ao.updateGtaoMaterial({ radius, distanceExponent: 1.6, thickness: 0.6, scale: 1, samples: 12 });
    ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    invalidate();
  }, [ao, radius, invalidate]);
  const [min, max] = bounds ?? [[0, 0, 0], [0, 0, 0]];
  const clipKey = bounds ? [...min, ...max].join(",") : "";
  useEffect(() => {
    // Background and the backdrop plane meet walls at a depth cliff that
    // otherwise turns into a speckled halo around the room.
    const [x0, y0, z0, x1, y1, z1] = clipKey ? clipKey.split(",").map(Number) : [];
    // The pass accepts null to clear the box; its typings only list Box3.
    const setClip = ao.setSceneClipBox.bind(ao) as (box: Box3 | null) => void;
    setClip(clipKey ? new Box3(new Vector3(x0, y0, z0), new Vector3(x1, y1, z1)) : null);
    invalidate();
  }, [ao, clipKey, invalidate]);
  useEffect(() => {
    // Occlusion is low frequency; 1.25× is sharp enough on retina screens and
    // keeps the cost flat while orbiting.
    const scale = Math.min(Math.max(initialDpr, 1), 1.25);
    ao.setSize(Math.max(1, Math.round(size.width * scale)), Math.max(1, Math.round(size.height * scale)));
    invalidate();
  }, [ao, size.width, size.height, initialDpr, invalidate]);
  useEffect(() => {
    invalidate();
    return () => {
      shared.plannerAoStrength.value = 0;
      shared.plannerAoMap.value = null;
      ao.dispose();
      invalidate();
    };
  }, [ao, invalidate]);
  // Priority 1 takes over rendering from the canvas.
  useFrame(() => {
    syncMasks(scene);
    ao.render(gl, null as never, null as never, 0, false);
    gl.setRenderTarget(null);
    gl.getDrawingBufferSize(shared.plannerAoResolution.value);
    shared.plannerAoMap.value = ao.pdRenderTarget.texture;
    shared.plannerAoStrength.value = 1;
    gl.render(scene, camera);
    shared.plannerAoStrength.value = 0;
  }, 1);
  return null;
}
