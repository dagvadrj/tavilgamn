/** One bounded snapshot per server worker. No expired data or errors are served. */
export function createCatalogCache<T>(read: () => Promise<T>, ttlMs = 15_000, now = Date.now) {
  let snapshot: { value: T; loadedAt: number } | undefined;
  let pending: Promise<T> | null = null;
  let pendingForced = false;
  let queuedForce: Promise<T> | null = null;

  function get(force = false): Promise<{ value: T; cache: "hit" | "miss" | "refresh" | "coalesced" }> {
    // A forced read must follow an older ordinary read, rather than reuse it.
    if (force && pending && !pendingForced) {
      if (!queuedForce) {
        queuedForce = pending.then(() => get(true).then(result => result.value), () => get(true).then(result => result.value))
          .finally(() => { queuedForce = null; });
      }
      return queuedForce.then(value => ({ value, cache: "refresh" }));
    }
    if (!force && snapshot && now() - snapshot.loadedAt < ttlMs) {
      return Promise.resolve({ value: snapshot.value, cache: "hit" });
    }
    if (pending) return pending.then(value => ({ value, cache: "coalesced" }));

    pendingForced = force;
    pending = Promise.resolve().then(read).then(value => {
      snapshot = { value, loadedAt: now() };
      return value;
    }).finally(() => { pending = null; pendingForced = false; });
    return pending.then(value => ({ value, cache: force ? "refresh" : "miss" }));
  }
  return { get };
}
