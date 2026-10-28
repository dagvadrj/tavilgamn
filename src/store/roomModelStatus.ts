"use client";
import { create } from "zustand";

/** «swapping»: a new variant loads while the previous model stays visible. */
export type RoomModelStatus = "loading" | "swapping" | "ready" | "error";

/** Ephemeral 3D load state per placed instance; never persisted with the design. */
interface State {
  byInstance: Record<string, RoomModelStatus>;
  /** Bumped by «Дахин оролдох»; the mesh remounts and requests the file again. */
  attempts: Record<string, number>;
  set: (instanceId: string, status: RoomModelStatus) => void;
  /** A new file for this instance: keep showing the old one if it was rendered. */
  begin: (instanceId: string) => void;
  retry: (instanceId: string) => void;
  clear: (instanceId: string) => void;
}

export const useRoomModelStatus = create<State>((set) => ({
  byInstance: {},
  attempts: {},
  set: (instanceId, status) =>
    set((state) =>
      state.byInstance[instanceId] === status
        ? state
        : { byInstance: { ...state.byInstance, [instanceId]: status } },
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
      if (!(instanceId in state.byInstance) && !(instanceId in state.attempts))
        return state;
      const { [instanceId]: _status, ...byInstance } = state.byInstance;
      const { [instanceId]: _attempt, ...attempts } = state.attempts;
      return { byInstance, attempts };
    }),
}));

/** Busy states shown as «Ачаалж байна» on catalog cards and rows. */
export const modelBusy = (status: RoomModelStatus | undefined) =>
  status === "loading" || status === "swapping";
