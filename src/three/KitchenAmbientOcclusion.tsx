"use client";

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { DoubleSide, HalfFloatType, Mesh, WebGLRenderTarget, type Material, type Object3D } from "three";
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
export function occludesKitchen(object: Object3D) {
  const kind = object as Object3D & { isLine?: boolean; isPoints?: boolean; isSprite?: boolean };
  if (kind.isLine || kind.isPoints || kind.isSprite) return false;
  if (!(object instanceof Mesh)) return true;
  // Pick proxies use invisible materials; fading walls stop writing depth.
  return materials(object).some(
    (material) => material.visible && material.colorWrite && material.depthWrite && material.opacity >= 0.5,
  );
}

class KitchenGTAOPass extends GTAOPass {
  private hidden: Object3D[] = [];
  overrideVisibility() {
    this.scene.traverse((object) => {
      if (object.visible && !occludesKitchen(object)) {
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
 * Contact darkening in corners, under wall units and between modules: the
 * cue a flat, evenly lit kitchen is missing. Skipped while the camera moves
 * so orbiting keeps the plain, faster frame.
 */
export function KitchenAmbientOcclusion() {
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
    const ao = new KitchenGTAOPass(scene, camera, 1, 1);
    // Catalog GLBs use double-sided panels, some with inverted vertex normals:
    // keep their depth, but derive normals from it so doors and sides stay light.
    ao.normalMaterial.side = DoubleSide;
    for (const material of [ao.gtaoMaterial, ao.pdMaterial]) {
      material.defines.NORMAL_VECTOR_TYPE = 0;
      material.needsUpdate = true;
    }
    ao.blendIntensity = 0.9;
    ao.updateGtaoMaterial({ radius: 0.32, distanceExponent: 1.4, thickness: 1, scale: 1, samples: 16 });
    ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
    composer.addPass(render);
    composer.addPass(ao);
    composer.addPass(new OutputPass());
    return { composer, render, ao };
  }, [gl, scene, camera]);
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
  // Priority 1 takes over rendering from the canvas.
  useFrame(() => {
    if (moving) gl.render(scene, camera);
    else pipeline.composer.render();
  }, 1);
  useEffect(() => invalidate(), [moving, invalidate]);
  return null;
}
