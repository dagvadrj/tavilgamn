type NetworkInformation = {
  saveData?: boolean;
  effectiveType?: string;
};

type NavigatorWithConnection = Navigator & {
  connection?: NetworkInformation;
};

const prefetched = new Map<string, Promise<void>>();
const queue: Array<() => void> = [];
let active = 0;

function pump() {
  while (active < 2 && queue.length) queue.shift()?.();
}

function schedule(task: () => Promise<void>) {
  return new Promise<void>((resolve, reject) => {
    queue.push(() => {
      active += 1;
      task()
        .then(resolve, reject)
        .finally(() => {
          active -= 1;
          pump();
        });
    });
    pump();
  });
}

export function modelDeliveryUrl(modelId: string, file: string) {
  return `/api/models/files/${encodeURIComponent(modelId)}/${encodeURIComponent(file)}`;
}

/** Warm the browser HTTP cache before Three.js needs to decode the model. */
export function prefetchModel(url: string): Promise<void> {
  if (typeof window === "undefined" || !url) return Promise.resolve();

  const connection = (navigator as NavigatorWithConnection).connection;
  if (connection?.saveData || connection?.effectiveType === "2g") {
    return Promise.resolve();
  }

  const existing = prefetched.get(url);
  if (existing) return existing;

  const pending = schedule(async () => {
    const response = await fetch(url, {
      cache: "force-cache",
      credentials: "same-origin",
    });
    if (!response.ok) throw new Error(`Model prefetch failed (${response.status})`);

    // Reading the body ensures the complete GLB, rather than only its headers,
    // is available when GLTFLoader starts.
    await response.arrayBuffer();
  }).catch(() => {
    prefetched.delete(url);
  });

  prefetched.set(url, pending);
  return pending;
}
