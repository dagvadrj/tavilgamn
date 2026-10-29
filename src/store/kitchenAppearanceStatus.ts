"use client";
import { create } from "zustand";

export type KitchenAppearance = { frontMaterialId?: string; carcassMaterialId?: string };

/**
 * K4 material swaps per cabinet. While «pending» the previous correct model
 * stays on screen (dimmed); on «error» it stays in full and the panel offers
 * retry or revert. `previous` is the appearance to revert to.
 */
interface State {
  byCabinet: Record<string, "pending" | "error">;
  previous: Record<string, KitchenAppearance>;
  /** Bumped by «Дахин оролдох»; the model requests again without dropping the old one. */
  retries: Record<string, number>;
  begin: (id: string, previous: KitchenAppearance) => void;
  ready: (id: string) => void;
  fail: (id: string) => void;
  retry: (id: string) => void;
  forget: (id: string) => void;
}

const subscribers = new Map<string, (onRetry: (count: number) => void) => () => void>();
/** A stable per-cabinet retry subscription for renderers that hold no hooks. */
export function kitchenRetrySubscriber(id: string) {
  let subscribe = subscribers.get(id);
  if (!subscribe) {
    subscribe = (onRetry) =>
      useKitchenAppearanceStatus.subscribe((state, previous) => {
        const count = state.retries[id] ?? 0;
        if (count !== (previous.retries[id] ?? 0)) onRetry(count);
      });
    subscribers.set(id, subscribe);
  }
  return subscribe;
}

const without = <T,>(record: Record<string, T>, key: string) => {
  if (!(key in record)) return record;
  const { [key]: _removed, ...rest } = record;
  return rest;
};

export const useKitchenAppearanceStatus = create<State>((set) => ({
  byCabinet: {},
  previous: {},
  retries: {},
  begin: (id, previous) =>
    set((state) => ({
      byCabinet: { ...state.byCabinet, [id]: "pending" },
      // A→B→C quickly: A is still the last model on screen.
      previous: id in state.previous ? state.previous : { ...state.previous, [id]: previous },
    })),
  ready: (id) =>
    set((state) =>
      id in state.byCabinet || id in state.previous
        ? { byCabinet: without(state.byCabinet, id), previous: without(state.previous, id) }
        : state,
    ),
  fail: (id) =>
    set((state) =>
      id in state.previous ? { byCabinet: { ...state.byCabinet, [id]: "error" } } : state,
    ),
  retry: (id) =>
    set((state) => ({
      byCabinet: { ...state.byCabinet, [id]: "pending" },
      retries: { ...state.retries, [id]: (state.retries[id] ?? 0) + 1 },
    })),
  forget: (id) =>
    set((state) => ({ byCabinet: without(state.byCabinet, id), previous: without(state.previous, id) })),
}));
