"use client";
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { exportRoomGlb } from "./roomExport";
export function RoomExportBridge({
  onReady,
}: {
  onReady: (exporter: (() => Promise<Blob>) | null) => void;
}) {
  const scene = useThree((state) => state.scene);
  useEffect(() => {
    onReady(() => exportRoomGlb(scene));
    return () => onReady(null);
  }, [scene, onReady]);
  return null;
}
