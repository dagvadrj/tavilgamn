"use client";

import { useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Color, DataTexture, EquirectangularReflectionMapping, FloatType, LinearFilter, NoColorSpace, PMREMGenerator, RGBAFormat, type Texture, type WebGLRenderTarget } from "three";
import type { RoomDesign } from "@/lib/types";
import { paintReflectionKey, paintReflectionPixels, paintReflectionRoom } from "./roomPaintReflection";

/** One shared 64px PMREM per room; no scene capture, animation loop or network asset. */
export function useRoomPaintEnvironment(design: RoomDesign): Texture | null {
  const key=paintReflectionKey(design);
  const gl=useThree(state=>state.gl),invalidate=useThree(state=>state.invalidate);
  const [environment,setEnvironment]=useState<{key:string;texture:Texture}|null>(null);
  useEffect(()=>{
    let target:WebGLRenderTarget|null=null;
    // Sliders may emit many changes; build only after the surface/light input settles.
    const timer=setTimeout(()=>{
      const pixels=paintReflectionPixels(paintReflectionRoom(key));
      const source=new DataTexture(pixels.data,pixels.width,pixels.height,RGBAFormat,FloatType);
      source.colorSpace=NoColorSpace;source.mapping=EquirectangularReflectionMapping;
      source.minFilter=source.magFilter=LinearFilter;source.needsUpdate=true;
      const previousTarget=gl.getRenderTarget(),previousFace=gl.getActiveCubeFace(),previousLevel=gl.getActiveMipmapLevel();
      const previousAutoClear=gl.autoClear,previousXr=gl.xr.enabled,previousAlpha=gl.getClearAlpha(),previousColor=gl.getClearColor(new Color());
      const generator=new PMREMGenerator(gl);
      try {
        target=generator.fromEquirectangular(source);
        setEnvironment({key,texture:target.texture});
        invalidate();
      } catch {
        // Keep the shared scene environment when a renderer cannot filter float textures.
      } finally {
        source.dispose();generator.dispose();
        gl.autoClear=previousAutoClear;gl.xr.enabled=previousXr;
        gl.setRenderTarget(previousTarget,previousFace,previousLevel);gl.setClearColor(previousColor,previousAlpha);
      }
    },150);
    return ()=>{clearTimeout(timer);target?.dispose();};
  },[key,gl,invalidate]);
  return environment?.key===key?environment.texture:null;
}
