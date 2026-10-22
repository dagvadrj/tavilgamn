import {
  ACESFilmicToneMapping,
  PCFSoftShadowMap,
  SRGBColorSpace,
  type WebGLRenderer,
} from "three";

/** Canvas owns shadow enablement, DPR and alpha; both planners share colour. */
export function configurePlannerRenderer(gl: WebGLRenderer) {
  gl.toneMapping = ACESFilmicToneMapping;
  gl.toneMappingExposure = 1;
  gl.outputColorSpace = SRGBColorSpace;
  if (gl.shadowMap.type !== PCFSoftShadowMap) {
    gl.shadowMap.type = PCFSoftShadowMap;
    gl.shadowMap.needsUpdate = true;
  }
}
