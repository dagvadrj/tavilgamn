"use client";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@/store/auth";
import { isOwner, merchantRequest } from "./merchantApi";

type State<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  updatedAt: number;
};
type Entry = {
  owner: string;
  path: string;
  state: State<unknown>;
  listeners: Set<() => void>;
  controller?: AbortController;
  touched: number;
  generation: number;
};
const entries = new Map<string, Entry>();
const empty: State<never> = {
  data: null,
  loading: true,
  error: null,
  updatedAt: 0,
};
const keyFor = (owner: string, path: string) => JSON.stringify([owner, path]);
function entryFor(owner: string, path: string) {
  const key = keyFor(owner, path);
  let entry = entries.get(key);
  if (!entry) {
    // This cache is memory-only and bounded; private data never goes to localStorage.
    for (const [oldKey, old] of entries)
      if (
        !old.listeners.size &&
        (entries.size >= 40 || Date.now() - old.touched > 300000)
      ) {
        old.controller?.abort();
        entries.delete(oldKey);
      }
    entry = {
      owner,
      path,
      state: empty,
      listeners: new Set(),
      touched: Date.now(),
      generation: 0,
    };
    entries.set(key, entry);
  }
  return entry;
}
function emit(entry: Entry) {
  entry.listeners.forEach((listener) => listener());
}
async function load(entry: Entry, force = false) {
  if (
    !isOwner(entry.owner) ||
    entry.controller ||
    (!force && Date.now() - entry.state.updatedAt < 30000)
  )
    return;
  const controller = new AbortController(),
    generation = ++entry.generation;
  entry.controller = controller;
  entry.state = { ...entry.state, loading: true, error: null };
  emit(entry);
  const timeout = setTimeout(() => {
    if (entry.controller !== controller || generation !== entry.generation)
      return;
    entry.generation++;
    entry.controller = undefined;
    controller.abort();
    entry.state = {
      ...entry.state,
      loading: false,
      error: "Хүсэлт удаж байна. Дахин оролдоно уу.",
    };
    emit(entry);
  }, 15000);
  try {
    const data = await merchantRequest(entry.path, entry.owner, {
      signal: controller.signal,
    });
    if (
      !controller.signal.aborted &&
      generation === entry.generation &&
      isOwner(entry.owner)
    )
      entry.state = {
        data,
        loading: false,
        error: null,
        updatedAt: Date.now(),
      };
  } catch (reason) {
    if (
      !controller.signal.aborted &&
      generation === entry.generation &&
      isOwner(entry.owner)
    )
      entry.state = {
        ...entry.state,
        loading: false,
        error:
          reason instanceof Error
            ? reason.message
            : "Мэдээллийг ачаалж чадсангүй.",
      };
  } finally {
    clearTimeout(timeout);
    if (entry.controller === controller) entry.controller = undefined;
    entry.touched = Date.now();
    emit(entry);
  }
}
export function invalidateMerchantResources(owner: string) {
  for (const entry of entries.values())
    if (entry.owner === owner) {
      entry.controller?.abort();
      entry.controller = undefined;
      entry.generation++;
      entry.state = { ...entry.state, updatedAt: 0 };
      emit(entry);
      if (entry.listeners.size) void load(entry, true);
    }
}
export function clearMerchantResources() {
  for (const entry of entries.values()) {
    entry.generation++;
    entry.controller?.abort();
    entry.state = empty;
    emit(entry);
  }
  entries.clear();
}
if (typeof window !== "undefined") {
  window.addEventListener("merchant-data-changed", (event) => {
    const owner = (event as CustomEvent<string>).detail;
    if (owner) invalidateMerchantResources(owner);
  });
  useAuth.subscribe?.((state, previous) => {
    if (state.user?.id !== previous.user?.id || state.role !== previous.role)
      clearMerchantResources();
  });
}

export function useMerchantResource<T>(
  owner: string,
  path: string,
  enabled = true,
  interval = 0,
) {
  const entry = entryFor(owner, path);
  const subscribe = useCallback(
    (listener: () => void) => {
      if (!enabled) return () => {};
      entry.listeners.add(listener);
      void load(entry);
      return () => {
        entry.listeners.delete(listener);
      };
    },
    [entry, enabled],
  );
  const snapshot = useCallback(
    () =>
      enabled && isOwner(owner)
        ? (entry.state as State<T>)
        : (empty as State<T>),
    [entry, enabled, owner],
  );
  const state = useSyncExternalStore(
    subscribe,
    snapshot,
    () => empty as State<T>,
  );
  useEffect(() => {
    if (!enabled) return;
    const refresh = () => {
      if (document.visibilityState === "visible" && navigator.onLine !== false)
        void load(entry, true);
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = interval ? window.setInterval(refresh, interval) : null;
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      if (timer !== null) window.clearInterval(timer);
    };
  }, [entry, enabled, interval]);
  return {
    ...state,
    refresh: useCallback(() => {
      void load(entry, true);
    }, [entry]),
  };
}
