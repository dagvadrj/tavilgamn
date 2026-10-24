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
  pending?: Promise<void>;
  touched: number;
  generation: number;
  transport: ResourceTransport;
};
type ResourceTransport = {
  request: (path: string, owner: string, init: RequestInit) => Promise<unknown>;
  isAuthorized: (owner: string) => boolean;
};
const merchantTransport: ResourceTransport = {
  request: merchantRequest,
  isAuthorized: isOwner,
};
const entries = new Map<string, Entry>();
const FRESH_MS = 5 * 60 * 1000;
const RETAIN_MS = 30 * 60 * 1000;
const empty: State<never> = {
  data: null,
  loading: true,
  error: null,
  updatedAt: 0,
};
const keyFor = (owner: string, path: string) => JSON.stringify([owner, path]);
function entryFor(owner: string, path: string, transport: ResourceTransport) {
  const key = keyFor(owner, path);
  let entry = entries.get(key);
  if (!entry) {
    // This cache is memory-only and bounded; private data never goes to localStorage.
    for (const [oldKey, old] of entries)
      if (
        !old.listeners.size &&
        (entries.size >= 80 || Date.now() - old.touched > RETAIN_MS)
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
      transport,
    };
    entries.set(key, entry);
  }
  return entry;
}
function emit(entry: Entry) {
  entry.listeners.forEach((listener) => listener());
}
function load(entry: Entry, force = false): Promise<void> {
  if (entry.pending) return entry.pending;
  if (
    !entry.transport.isAuthorized(entry.owner) ||
    (!force &&
      entry.state.updatedAt > 0 &&
      Date.now() - entry.state.updatedAt < FRESH_MS)
  )
    return Promise.resolve();
  const pending = performLoad(entry, force);
  entry.pending = pending;
  void pending.finally(() => {
    if (entry.pending === pending) entry.pending = undefined;
  });
  return pending;
}
async function performLoad(entry: Entry, force = false) {
  if (
    !entry.transport.isAuthorized(entry.owner) ||
    entry.controller ||
    (!force &&
      entry.state.updatedAt > 0 &&
      Date.now() - entry.state.updatedAt < FRESH_MS)
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
    const data = await entry.transport.request(entry.path, entry.owner, {
      signal: controller.signal,
    });
    if (
      !controller.signal.aborted &&
      generation === entry.generation &&
      entry.transport.isAuthorized(entry.owner)
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
      entry.transport.isAuthorized(entry.owner)
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
      entry.pending = undefined;
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

/** Imperative editors share the same cache, invalidation and identity checks as panels. */
export async function readMerchantResource<T>(
  owner: string,
  path: string,
  force = false,
  transport: ResourceTransport = merchantTransport,
): Promise<T> {
  const entry = entryFor(owner, path, transport);
  entry.touched = Date.now();
  await load(entry, force);
  if (
    !entry.state.updatedAt &&
    !entry.state.error &&
    transport.isAuthorized(owner)
  )
    await load(entry);
  if (!transport.isAuthorized(owner))
    throw new Error("Нэвтрэлт өөрчлөгдсөн байна.");
  if (entry.state.error) throw new Error(entry.state.error);
  if (!entry.state.data) throw new Error("Мэдээллийг ачаалж чадсангүй.");
  return entry.state.data as T;
}
if (typeof window !== "undefined") {
  window.addEventListener("admin-data-changed", (event) => {
    const owner = (event as CustomEvent<string>).detail;
    if (owner) invalidateMerchantResources(owner);
  });
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
  transport: ResourceTransport = merchantTransport,
) {
  const entry = entryFor(owner, path, transport);
  const subscribe = useCallback(
    (listener: () => void) => {
      if (!enabled) return () => {};
      entry.listeners.add(listener);
      entry.touched = Date.now();
      void load(entry);
      return () => {
        entry.listeners.delete(listener);
      };
    },
    [entry, enabled],
  );
  const snapshot = useCallback(
    () =>
      enabled && entry.transport.isAuthorized(owner)
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
        void load(entry);
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = interval
      ? window.setInterval(() => {
          if (
            document.visibilityState === "visible" &&
            navigator.onLine !== false
          )
            void load(entry, true);
        }, interval)
      : null;
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
