let pending: Promise<void> | null = null;

/** Load the AR component only when the user opens AR; share existing kitchen loads. */
export function loadProductModelViewer(): Promise<void> {
  if (customElements.get("model-viewer")) return Promise.resolve();
  if (pending) return pending;
  pending = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-product-model-viewer], script[data-kitchen-model-viewer]');
    const script = existing ?? document.createElement("script");
    const timeout = window.setTimeout(() => failed(), 25000);
    const cleanup = () => { window.clearTimeout(timeout); script.removeEventListener("load", loaded); script.removeEventListener("error", failed); };
    const loaded = () => {
      cleanup();
      if (customElements.get("model-viewer")) resolve();
      else { script.remove(); pending = null; reject(new Error("AR viewer бэлэн болоогүй байна. Дахин оролдоорой.")); }
    };
    const failed = () => { cleanup(); pending = null; script.remove(); reject(new Error("AR viewer ачаалсангүй. Холболтоо шалгаад дахин оролдоорой.")); };
    script.addEventListener("load", loaded, { once: true });
    script.addEventListener("error", failed, { once: true });
    if (!existing) {
      script.type = "module";
      script.src = "https://ajax.googleapis.com/ajax/libs/model-viewer/4.3.1/model-viewer.min.js";
      script.dataset.productModelViewer = "true";
      document.head.appendChild(script);
    }
  });
  return pending;
}
