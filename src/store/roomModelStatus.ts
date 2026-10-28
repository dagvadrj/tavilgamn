"use client";
import { create } from "zustand";
import type { PlacedFurniture } from "@/lib/types";

/** «swapping»: a new variant loads while the previous model stays visible. */
export type RoomModelStatus = "loading" | "swapping" | "ready" | "error";

/** Ephemeral 3D load state per placed instance; never persisted with the design. */
interface State {
  byInstance: Record<string, RoomModelStatus>;
  /** Bumped by «Дахин оролдох»; the mesh remounts and requests the file again. */
  attempts: Record<string, number>;
  /**
   * D2: the piece as it was before a replacement, while the new model is not
   * on screen yet. «Буцаах» restores it; a ready new model forgets it.
   */
  previous: Record<string, PlacedFurniture>;
  /** The new file failed; the previous model is still shown in full. */
  swapFailed: Record<string, true>;
  /** Bumped by a swap retry; the mesh requests again without remounting. */
  swapRetries: Record<string, number>;
  set: (instanceId: string, status: RoomModelStatus) => void;
  /** A new file for this instance: keep showing the old one if it was rendered. */
  begin: (instanceId: string) => void;
  retry: (instanceId: string) => void;
  /** Before replacing: keep the visible piece unless a swap is already pending. */
  remember: (piece: PlacedFurniture) => void;
  swapError: (instanceId: string) => void;
  retrySwap: (instanceId: string) => void;
  /** Revert or a later edit: the retained snapshot no longer applies. */
  forget: (instanceId: string) => void;
  clear: (instanceId: string) => void;
}

const without = <T,>(record: Record<string, T>, key: string) => {
  if (!(key in record)) return record;
  const { [key]: _removed, ...rest } = record;
  return rest;
};

export const useRoomModelStatus = create<State>((set) => ({
  byInstance: {},
  attempts: {},
  previous: {},
  swapFailed: {},
  swapRetries: {},
  set: (instanceId, status) =>
    set((state) => {
      const same = state.byInstance[instanceId] === status;
      const byInstance = same
        ? state.byInstance
        : { ...state.byInstance, [instanceId]: status };
      if (status !== "ready") return same ? state : { byInstance };
      // The requested model is on screen: nothing to revert to any more.
      const previous = without(state.previous, instanceId);
      const swapFailed = without(state.swapFailed, instanceId);
      return same && previous === state.previous && swapFailed === state.swapFailed
        ? state
        : { byInstance, previous, swapFailed };
    }),
  remember: (piece) =>
    set((state) => {
      const id = piece.instanceId;
      // A→B→C quickly: A is still the model on screen, so A stays the target.
      if (id in state.previous && !(id in state.swapFailed)) return state;
      return {
        previous: { ...state.previous, [id]: piece },
        swapFailed: without(state.swapFailed, id),
      };
    }),
  swapError: (instanceId) =>
    set((state) => ({
      byInstance: { ...state.byInstance, [instanceId]: "ready" },
      swapFailed: { ...state.swapFailed, [instanceId]: true },
    })),
  retrySwap: (instanceId) =>
    set((state) => ({
      byInstance: { ...state.byInstance, [instanceId]: "swapping" },
      swapFailed: without(state.swapFailed, instanceId),
      swapRetries: {
        ...state.swapRetries,
        [instanceId]: (state.swapRetries[instanceId] ?? 0) + 1,
      },
    })),
  forget: (instanceId) =>
    set((state) =>
      instanceId in state.previous || instanceId in state.swapFailed
        ? {
            previous: without(state.previous, instanceId),
            swapFailed: without(state.swapFailed, instanceId),
          }
        : state,
    ),
  begin: (instanceId) =>
    set((state) => {
      const previous = state.byInstance[instanceId];
      const next =
        previous === "ready" || previous === "swapping"
          ? "swapping"
          : "loading";
      return previous === next
        ? state
        : { byInstance: { ...state.byInstance, [instanceId]: next } };
    }),
  retry: (instanceId) =>
    set((state) => ({
      byInstance: { ...state.byInstance, [instanceId]: "loading" },
      attempts: {
        ...state.attempts,
        [instanceId]: (state.attempts[instanceId] ?? 0) + 1,
      },
    })),
  clear: (instanceId) =>
    set((state) => {
      const next = {
        byInstance: without(state.byInstance, instanceId),
        attempts: without(state.attempts, instanceId),
        previous: without(state.previous, instanceId),
        swapFailed: without(state.swapFailed, instanceId),
        swapRetries: without(state.swapRetries, instanceId),
      };
      return (Object.keys(next) as (keyof typeof next)[]).every(
        (key) => next[key] === state[key],
      )
        ? state
        : next;
    }),
}));

/** Busy states shown as «Ачаалж байна» on catalog cards and rows. */
export const modelBusy = (status: RoomModelStatus | undefined) =>
  status === "loading" || status === "swapping";
