"use client";
import { create } from "zustand";
import type { KitchenFinishChoice } from "@/lib/kitchenFinishes";

/** Finishes a buyer picked in a design's 3D view, read by its quote form. */
export const useKitchenFinishes = create<{
  choices: Record<string, KitchenFinishChoice>;
  choose: (designId: string, choice: KitchenFinishChoice) => void;
}>((set) => ({
  choices: {},
  choose: (designId, choice) =>
    set((state) => ({ choices: { ...state.choices, [designId]: choice } })),
}));
