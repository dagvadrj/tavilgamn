"use client";
import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { DesignRoom } from "@/lib/types";
import type { Bounds } from "@/lib/roomGeometry";
import { getRoomGeometry } from "@/lib/roomGeometry";
import { roomPosition } from "@/lib/roomLayout";

/** Render a separate overview camera without moving the user's live camera. */
export function captureRoomPreview(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  bounds: Bounds,
  height: number,
  rooms: DesignRoom[],
  origin: { x: number; z: number },
) {
  const width = 768,
    imageHeight = 480,
    camera = new THREE.PerspectiveCamera(40, width / imageHeight, 0.1, 1000);
  const centre = new THREE.Vector3(
    (bounds.minX + bounds.maxX) / 2,
    height * 0.35,
    (bounds.minZ + bounds.maxZ) / 2,
  );
  const direction = new THREE.Vector3(0.8, 0.75, 0.82).normalize();
  camera.position.copy(centre).add(direction);
  camera.lookAt(centre);
  const inverse = camera.quaternion.clone().invert();
  const tanVertical = Math.tan(THREE.MathUtils.degToRad(20));
  const tanHorizontal = tanVertical * camera.aspect;
  let distance = 1;
  for (const x of [bounds.minX, bounds.maxX])
    for (const y of [0, height])
      for (const z of [bounds.minZ, bounds.maxZ]) {
        const p = new THREE.Vector3(x, y, z)
          .sub(centre)
          .applyQuaternion(inverse);
        distance = Math.max(
          distance,
          p.z + Math.abs(p.x) / (tanHorizontal * 0.9),
          p.z + Math.abs(p.y) / (tanVertical * 0.9),
        );
      }
  camera.position.copy(centre).addScaledVector(direction, distance);
  camera.updateMatrixWorld();
  const target = new THREE.WebGLRenderTarget(width, imageHeight);
  target.texture.colorSpace = THREE.SRGBColorSpace;
  const previous = gl.getRenderTarget(),
    background = scene.background;
  const viewport = gl.getViewport(new THREE.Vector4()),
    scissor = gl.getScissor(new THREE.Vector4()),
    scissorTest = gl.getScissorTest();
  const restore: Array<() => void> = [];
  try {
    scene.updateMatrixWorld(true);
    scene.traverse((object) => {
      if (object.userData.previewRoof) {
        const visible = object.visible;
        object.visible = false;
        restore.push(() => {
          object.visible = visible;
        });
      }
      if (
        object.userData.previewWall &&
        object instanceof THREE.Mesh &&
        !Array.isArray(object.material)
      ) {
        const material = object.material as THREE.MeshStandardMaterial,
          { nx, nz } = object.userData.previewWall;
        const p = object.getWorldPosition(new THREE.Vector3());
        const outside =
          (camera.position.x - p.x) * nx + (camera.position.z - p.z) * nz <
          -0.06;
        const { opacity, transparent, depthWrite } = material;
        material.opacity = outside ? 0.04 : 1;
        material.transparent = outside;
        material.depthWrite = !outside;
        material.needsUpdate = true;
        restore.push(() => {
          material.opacity = opacity;
          material.transparent = transparent;
          material.depthWrite = depthWrite;
          material.needsUpdate = true;
        });
      }
    });
    scene.background = new THREE.Color("#252c38");
    gl.setRenderTarget(target);
    gl.setScissorTest(false);
    gl.clear();
    gl.render(scene, camera);
    const pixels = new Uint8Array(width * imageHeight * 4);
    gl.readRenderTargetPixels(target, 0, 0, width, imageHeight, pixels);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = imageHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Зураг үүсгэж чадсангүй.");
    const data = ctx.createImageData(width, imageHeight);
    for (let row = 0; row < imageHeight; row++)
      data.data.set(
        pixels.subarray(row * width * 4, (row + 1) * width * 4),
        (imageHeight - row - 1) * width * 4,
      );
    ctx.putImageData(data, 0, 0);
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    for (const room of rooms) {
      const p = roomPosition(room),
        v = new THREE.Vector3(p.x - origin.x, 0.4, p.z - origin.z).project(
          camera,
        );
      const x = ((v.x + 1) / 2) * width,
        y = ((1 - v.y) / 2) * imageHeight;
      ctx.fillStyle = "#fffffff0";
      ctx.beginPath();
      ctx.roundRect(x - 47, y - 16, 94, 35, 8);
      ctx.fill();
      ctx.fillStyle = "#263848";
      ctx.fillText(room.name, x, y - 2, 86);
      ctx.font = "9px sans-serif";
      ctx.fillText(`${getRoomGeometry(room).area.toFixed(1)} м²`, x, y + 11);
      ctx.font = "bold 10px sans-serif";
    }
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    restore.reverse().forEach((fn) => fn());
    scene.background = background;
    gl.setRenderTarget(previous);
    gl.setViewport(viewport);
    gl.setScissor(scissor);
    gl.setScissorTest(scissorTest);
    target.dispose();
  }
}

export function RoomPreviewCapture({
  designId,
  revision,
  bounds,
  height,
  rooms,
  origin,
  onCapture,
  onReady,
}: {
  designId: string;
  revision: number;
  bounds: Bounds;
  height: number;
  rooms: DesignRoom[];
  origin: { x: number; z: number };
  onCapture?: (id: string, image: string) => void;
  onReady?: (capture: (() => void) | null) => void;
}) {
  const { gl, scene } = useThree();
  const latest = useRef({ designId, bounds, height, rooms, origin, onCapture });
  latest.current = { designId, bounds, height, rooms, origin, onCapture };
  useEffect(() => {
    const capture = () => {
      const p = latest.current;
      try {
        p.onCapture?.(
          p.designId,
          captureRoomPreview(gl, scene, p.bounds, p.height, p.rooms, p.origin),
        );
      } catch {
        /* Retain the last successful preview if the canvas is unavailable. */
      }
    };
    onReady?.(capture);
    const leave = () => capture();
    window.addEventListener("pagehide", leave);
    return () => {
      onReady?.(null);
      window.removeEventListener("pagehide", leave);
    };
  }, [gl, scene, onReady]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const p = latest.current;
      try {
        p.onCapture?.(
          p.designId,
          captureRoomPreview(gl, scene, p.bounds, p.height, p.rooms, p.origin),
        );
      } catch {}
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [gl, scene, designId, revision]);
  return null;
}
