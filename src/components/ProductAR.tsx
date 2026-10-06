"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import type { Group } from "three";
import { loadProductModelViewer } from "@/lib/modelViewer";

type ARElement = HTMLElement & {
  canActivateAR?: boolean;
  activateAR?: () => Promise<void>;
};

export function ProductAR({
  scene,
  name,
  selectionKey,
  close,
}: {
  scene: Group | null;
  name: string;
  selectionKey: string;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const viewer = useRef<ARElement | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [arReady, setArReady] = useState(false);
  const [retry, setRetry] = useState(0);
  const [working, setWorking] = useState(false);
  useEffect(() => {
    const element = dialog.current,
      previous = document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  useEffect(() => {
    setError("");
    setSource(null);
    setArReady(false);
    if (!scene) return;
    let cancelled = false,
      objectUrl: string | null = null,
      timer: ReturnType<typeof setTimeout> | undefined;
    let cancelWait: (() => void) | undefined;
    async function prepare() {
      try {
        await loadProductModelViewer();
        if (cancelled) return;
        // Wait for the delivery GLB and the last appearance animation, not its preview.
        const started = Date.now();
        await new Promise<void>((resolve, reject) => {
          cancelWait = resolve;
          const check = () => {
            if (cancelled) {
              resolve();
              return;
            }
            let ready = scene!.userData.appearanceReady === true;
            scene!.traverse((node) => {
              if (node.userData.deliveryPending && !node.userData.deliveryReady)
                ready = false;
            });
            if (ready) resolve();
            else if (Date.now() - started > 45000)
              reject(
                new Error(
                  "3D загвар удаан ачаалж байна. Түр хүлээгээд дахин оролдоорой.",
                ),
              );
            else timer = setTimeout(check, 100);
          };
          // Give React/Three a frame to commit the selected appearance.
          timer = setTimeout(check, 100);
        });
        if (cancelled) return;
        const { exportProductForAR } = await import("@/three/productExport");
        const blob = await exportProductForAR(scene!);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSource(objectUrl);
      } catch (cause) {
        if (!cancelled)
          setError(
            cause instanceof Error
              ? cause.message
              : "AR загвар бэлдэж чадсангүй.",
          );
      }
    }
    void prepare();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      cancelWait?.();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [scene, selectionKey, retry]);
  useEffect(() => {
    const element = viewer.current;
    if (!element || !source) return;
    const loaded = () => {
      setArReady(Boolean(element.canActivateAR));
    };
    const failed = () =>
      setError("AR загварыг нээж чадсангүй. Дахин оролдоорой.");
    element.addEventListener("load", loaded);
    element.addEventListener("error", failed);
    const capabilityCheck = window.setInterval(loaded, 300);
    return () => {
      window.clearInterval(capabilityCheck);
      element.removeEventListener("load", loaded);
      element.removeEventListener("error", failed);
    };
  }, [source]);
  async function launchAR() {
    if (!viewer.current?.canActivateAR || working) return;
    setWorking(true);
    setError("");
    try {
      await viewer.current.activateAR?.();
    } catch {
      setError(
        "Камерын AR нээгдсэнгүй. Төхөөрөмжийн дэмжлэг болон HTTPS холболтыг шалгаарай.",
      );
    } finally {
      setWorking(false);
    }
  }
  return (
    <dialog
      className="pdp-ar-dialog"
      ref={dialog}
      aria-label={`${name} — өрөөндөө AR-аар байрлуулах`}
      onCancel={close}
      onClose={close}
    >
      <div className="pdp-ar-heading">
        <div>
          <h2>Өрөөндөө байрлуулж үзэх</h2>
          <p>Сонгосон өнгө, материал · бодит хэмжээ</p>
        </div>
        <button type="button" onClick={close} aria-label="AR цонх хаах">
          <X size={20} />
        </button>
      </div>
      <div className="pdp-ar-canvas">
        {source ? (
          <model-viewer
            ref={(element: HTMLElement | null) => {
              viewer.current = element as ARElement | null;
            }}
            src={source}
            alt={name}
            ar={true}
            ar-modes="webxr quick-look"
            ar-scale="fixed"
            camera-controls=""
            shadow-intensity="1"
            exposure="1"
          />
        ) : (
          !error && (
            <p role="status">
              <Loader2 size={22} className="animate-spin" aria-hidden="true" />
              Сонгосон 3D загварыг AR-д бэлдэж байна…
            </p>
          )
        )}
      </div>
      <div className="pdp-ar-footer">
        {error && <p role="alert">{error}</p>}
        {error ? (
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            Дахин оролдох
          </button>
        ) : (
          <button
            type="button"
            disabled={!arReady || working}
            onClick={() => void launchAR()}
          >
            <Camera size={18} aria-hidden="true" />
            {working ? "AR нээж байна…" : "Камераараа өрөөндөө байрлуулах"}
          </button>
        )}
        {source && !arReady && (
          <p>
            Камерт байрлуулахад AR дэмждэг утас, HTTPS холбоос хэрэгтэй. Энд 3D
            дүрсийг эргүүлж үзэх боломжтой.
          </p>
        )}
      </div>
    </dialog>
  );
}
