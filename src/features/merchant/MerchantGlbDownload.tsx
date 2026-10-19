"use client";
import { useEffect, useRef, useState } from "react";
import { Download, LoaderCircle } from "lucide-react";
import { isOwner, merchantRequest } from "./merchantApi";
export function MerchantGlbDownload({
  owner,
  productId,
}: {
  owner: string;
  productId: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    setBusy(false);
    setError("");
    return () => controller.current?.abort();
  }, [owner, productId]);
  return (
    <span>
      <button
        type="button"
        className="btn-ghost"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          const abort = new AbortController();
          controller.current?.abort();
          controller.current = abort;
          try {
            const path = `/api/merchant/products/${encodeURIComponent(productId)}/glb`;
            await merchantRequest(path, owner, {
              method: "POST",
              signal: abort.signal,
            });
            let result:
              { ready: boolean; url?: string; status: string } | undefined;
            for (let attempt = 0; attempt < 60; attempt++) {
              result = await merchantRequest(path, owner, {
                signal: abort.signal,
              });
              if (result?.ready && result.url) break;
              if (result?.status === "error")
                throw new Error(
                  "Blender файл бэлтгэж чадсангүй. Дахин оролдоно уу.",
                );
              await new Promise<void>((resolve, reject) => {
                const onAbort = () => {
                  clearTimeout(timer);
                  reject(new DOMException("Aborted", "AbortError"));
                };
                const timer = setTimeout(() => {
                  abort.signal.removeEventListener("abort", onAbort);
                  resolve();
                }, 2000);
                if (abort.signal.aborted) onAbort();
                else
                  abort.signal.addEventListener("abort", onAbort, {
                    once: true,
                  });
              });
            }
            if (abort.signal.aborted || !isOwner(owner)) return;
            if (!result?.ready || !result.url)
              throw new Error(
                "Blender файл бэлтгэгдэж байна. Түр хүлээгээд дахин дарна уу.",
              );
            const link = document.createElement("a");
            link.href = result.url;
            link.download = `product-${productId}-blender.glb`;
            document.body.appendChild(link);
            link.click();
            link.remove();
          } catch (reason) {
            if (!abort.signal.aborted && isOwner(owner))
              setError(
                reason instanceof Error
                  ? reason.message
                  : "GLB татаж чадсангүй.",
              );
          } finally {
            if (!abort.signal.aborted) setBusy(false);
          }
        }}
      >
        {busy ? (
          <LoaderCircle size={15} className="animate-spin" />
        ) : (
          <Download size={15} />
        )}
        {busy ? "GLB файл бэлтгэж байна…" : "GLB татах · Blender / SketchUp"}
      </button>
      {error && <small role="alert">{error}</small>}
    </span>
  );
}
