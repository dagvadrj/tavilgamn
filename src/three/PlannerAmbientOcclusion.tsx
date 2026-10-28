"use client";

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Box3, DoubleSide, HalfFloatType, Mesh, Vector3, WebGLRenderTarget, type Material, type Object3D } from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { useCameraMotionPreview } from "./CameraMotionPreview";

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
 * Contact darkening in corners, along skirting, under wall units and between
 * modules: the cue a flat, evenly lit room or kitchen is missing. The AO pass is
 * skipped while the camera or furniture moves so those frames stay fast.
 */
export function PlannerAmbientOcclusion({
  normals = "depth",
  bounds,
}: {
  /**
   * "depth" rebuilds normals from depth (kitchen catalog GLBs carry inverted
   * vertex normals); "buffer" uses rendered normals, cleaner at silhouettes.
   */
  normals?: "depth" | "buffer";
  /** World box [min, max] in metres; no occlusion is computed outside it. */
  bounds?: [[number, number, number], [number, number, number]];
} = {}) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const dpr = useThree((state) => state.viewport.dpr);
  const invalidate = useThree((state) => state.invalidate);
  const moving = useCameraMotionPreview();
  const pipeline = useMemo(() => {
    // MSAA keeps cabinet edges as smooth as the canvas's own antialiasing.
    const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 });
    const composer = new EffectComposer(gl, target);
    const render = new RenderPass(scene, camera);
    const ao = new PlannerGTAOPass(scene, camera, 1, 1);
    ao.normalMaterial.side = DoubleSide;
    if (normals === "depth")
      for (const material of [ao.gtaoMaterial, ao.pdMaterial]) {
        material.defines.NORMAL_VECTOR_TYPE = 0;
        material.needsUpdate = true;
      }
    ao.blendIntensity = 1;
    ao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.2, thickness: 1, scale: 1, samples: 16 });
    ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
    composer.addPass(render);
    composer.addPass(ao);
    composer.addPass(new OutputPass());
    return { composer, render, ao };
  }, [gl, scene, camera, normals]);
  const [min, max] = bounds ?? [[0, 0, 0], [0, 0, 0]];
  const clipKey = bounds ? [...min, ...max].join(",") : "";
  useEffect(() => {
    // Background and the backdrop plane meet walls at a depth cliff that
    // otherwise turns into a speckled halo around the room.
    const [x0, y0, z0, x1, y1, z1] = clipKey ? clipKey.split(",").map(Number) : [];
    // The pass accepts null to clear the box; its typings only list Box3.
    const setClip = pipeline.ao.setSceneClipBox.bind(pipeline.ao) as (box: Box3 | null) => void;
    setClip(clipKey ? new Box3(new Vector3(x0, y0, z0), new Vector3(x1, y1, z1)) : null);
    invalidate();
  }, [pipeline, clipKey, invalidate]);
  useEffect(() => {
    pipeline.composer.setPixelRatio(dpr);
    pipeline.composer.setSize(size.width, size.height);
    invalidate();
  }, [pipeline, size.width, size.height, dpr, invalidate]);
  useEffect(() => {
    invalidate();
    return () => {
      pipeline.ao.dispose();
      pipeline.composer.dispose();
      invalidate();
    };
  }, [pipeline, invalidate]);
  // Priority 1 takes over rendering from the canvas. Motion frames still go
  // through the composer with only the AO pass skipped: rendering straight to
  // the screen needs a TONE_MAPPING variant of every material, and compiling
  // those on the first furniture drag stalled the planner for seconds.
  useFrame(() => {
    pipeline.ao.enabled = !moving;
    pipeline.composer.render();
  }, 1);
  useEffect(() => invalidate(), [moving, invalidate]);
  return null;
}
