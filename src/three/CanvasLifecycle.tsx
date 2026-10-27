"use client";
import { useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import { bindCanvasLifecycle } from "./canvasLifecycleBinding";

export function CanvasLifecycle({ paused, onUnavailable }: {
  paused: boolean;
  onUnavailable: (lost: boolean) => void;
}) {
  const gl = useThree(state => state.gl);
  const setFrameloop = useThree(state => state.setFrameloop);
  const invalidate = useThree(state => state.invalidate);
  useEffect(() => bindCanvasLifecycle({
    canvas: gl.domElement,
    visibility: document,
    paused,
    isContextLost: () => gl.getContext().isContextLost(),
    setLoop: setFrameloop,
    refresh: () => { gl.shadowMap.needsUpdate = true; invalidate(); },
    onUnavailable,
  }), [gl, paused, setFrameloop, invalidate, onUnavailable]);
  return null;
}

/** GPU-only render targets lose their contents. Rebuild those captures, without
 * remounting furniture, the camera, controls or the user's design. */
export function useContextRevision() {
  const gl = useThree(state => state.gl);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const restore = () => setRevision(value => value + 1);
    gl.domElement.addEventListener("webglcontextrestored", restore);
    return () => gl.domElement.removeEventListener("webglcontextrestored", restore);
  }, [gl]);
  return revision;
}
