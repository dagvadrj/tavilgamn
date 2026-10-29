"use client";

import { memo, useLayoutEffect, useRef, type ComponentType } from "react";

/** Design fields that change while furniture moves but never shape walls or lights. */
const FURNITURE_ONLY = new Set(["pieces", "updatedAt", "previewImage"]);

/**
 * Content signature of props, ignoring furniture and callback identity.
 * `syncDesignRooms` deep-clones every room on each edit, so references always
 * change; comparing content is what tells a furniture drag from a room edit.
 */
export function furnitureIndependentSignature(props: object) {
  return JSON.stringify(props, (key, value) =>
    FURNITURE_ONLY.has(key) ? undefined : typeof value === "function" ? "ƒ" : value,
  );
}

/**
 * Re-renders the wrapped room component only when its non-furniture input
 * changes. Callbacks are forwarded through stable proxies to their latest
 * version, so a skipped render never calls a stale handler.
 */
export function furnitureIndependent<P extends object>(Component: ComponentType<P>) {
  const Memo = memo(
    Component,
    (previous, next) => furnitureIndependentSignature(previous) === furnitureIndependentSignature(next),
  );
  function FurnitureIndependent(props: P) {
    const latest = useRef(props);
    const proxies = useRef(new Map<string, (...args: unknown[]) => unknown>());
    useLayoutEffect(() => {
      latest.current = props;
    });
    const forwarded: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(props)) {
      if (typeof value !== "function") {
        forwarded[key] = value;
        continue;
      }
      let proxy = proxies.current.get(key);
      if (!proxy) {
        proxy = (...args: unknown[]) =>
          ((latest.current as Record<string, unknown>)[key] as ((...args: unknown[]) => unknown) | undefined)?.(...args);
        proxies.current.set(key, proxy);
      }
      forwarded[key] = proxy;
    }
    return <Memo {...(forwarded as P)} />;
  }
  FurnitureIndependent.displayName = `FurnitureIndependent(${Component.displayName ?? Component.name})`;
  return FurnitureIndependent;
}
