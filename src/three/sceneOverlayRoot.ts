import { createRoot } from "react-dom/client";

/** Each effect setup owns a fresh container, including Strict Mode effect replay. */
export function mountSceneOverlayRoot(host: HTMLElement) {
  const element = host.ownerDocument.createElement("div");
  const root = createRoot(element);
  host.appendChild(element);
  let disposed = false;
  return {
    element,
    render: (children: Parameters<typeof root.render>[0]) => {
      if (!disposed) root.render(children);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      // Hide and detach immediately. remove() also tolerates reparented/detached nodes.
      element.style.display = "none";
      element.style.pointerEvents = "none";
      element.remove();
      // The R3F renderer can be committing here. Never synchronously unmount
      // another React root from its cleanup, or reuse this container on remount.
      queueMicrotask(() => root.unmount());
    },
  };
}
