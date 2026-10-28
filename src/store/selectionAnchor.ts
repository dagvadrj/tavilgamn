"use client";
import { create } from "zustand";
import type { ScreenRect } from "@/lib/roomProductOptions";

/** Client-pixel bounds of the selected piece, written only on rendered frames. */
export const useSelectionAnchor = create<{ instanceId: string | null; rect: ScreenRect | null }>(() => ({
  instanceId: null,
  rect: null,
}));

export function setSelectionAnchor(instanceId: string, rect: ScreenRect | null) {
  useSelectionAnchor.setState({ instanceId, rect });
}

export function clearSelectionAnchor(instanceId: string) {
  if (useSelectionAnchor.getState().instanceId === instanceId)
    useSelectionAnchor.setState({ instanceId: null, rect: null });
}
