"use client";

import { useEffect, useRef, useState } from "react";
import { Box, Loader2, X } from "lucide-react";
import type { Group } from "three";
let modelViewerPromise: Promise<void> | null = null;

function loadModelViewer() {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (customElements.get("model-viewer")) {
    return Promise.resolve();
  }

  if (modelViewerPromise) {
    return modelViewerPromise;
  }

  modelViewerPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-kitchen-model-viewer="true"]',
    );

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });

      existing.addEventListener(
        "error",
        () => reject(new Error("AR viewer ачаалж чадсангүй.")),
        { once: true },
      );

      return;
    }

    const script = document.createElement("script");

    script.type = "module";

    script.src =
      "https://ajax.googleapis.com/ajax/libs/model-viewer/4.3.1/model-viewer.min.js";

    script.dataset.kitchenModelViewer = "true";

    script.onload = () => resolve();

    script.onerror = () => {
      modelViewerPromise = null;

      reject(new Error("AR viewer ачаалж чадсангүй."));
    };

    document.head.appendChild(script);
  });

  return modelViewerPromise;
}
type ModelViewerElement = HTMLElement & {
  activateAR?: () => Promise<void>;
  canActivateAR?: boolean;
};

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        [attribute: string]: unknown;
      };
    }
  }
}

export function KitchenARViewer({
  root,
  name,
  disabled,
  onWorkingChange,
}: {
  root: Group | null;
  name: string;
  disabled: boolean;
  onWorkingChange?: (working: boolean) => void;
}) {
  const [source, setSource] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const viewer = useRef<ModelViewerElement | null>(null);

  useEffect(() => {
    return () => {
      if (source) URL.revokeObjectURL(source);
    };
  }, [source]);

  async function openAR() {
    if (!root || disabled || working) return;
    setWorking(true);
    onWorkingChange?.(true);
    setMessage("");
    try {
      await loadModelViewer();
      const { encodeKitchenGlb } = await import("@/three/kitchenExport");
      const data = await encodeKitchenGlb(root);
      const nextSource = URL.createObjectURL(
        new Blob([data], { type: "model/gltf-binary" }),
      );
      setSource((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return nextSource;
      });
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "AR загварыг бэлдэж чадсангүй. Дахин оролдоно уу.",
      );
    } finally {
      setWorking(false);
      onWorkingChange?.(false);
    }
  }

  function close() {
    setSource((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return null;
    });
  }

  async function launchAR() {
    if (!viewer.current?.canActivateAR) {
      setMessage(
        "Энэ browser эсвэл төхөөрөмж AR дэмжихгүй байна. Утсаар, нэг Wi-Fi дээрх хаягаар нээгээд дахин оролдоно уу.",
      );
      return;
    }
    try {
      await viewer.current.activateAR?.();
    } catch {
      setMessage(
        "AR нээж чадсангүй. Утасны camera permission болон HTTPS тохиргоог шалгана уу.",
      );
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn-ghost"
        disabled={disabled || !root || working}
        onClick={() => void openAR()}
      >
        {working ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Box size={16} />
        )}
        {working ? "AR бэлдэж байна…" : "AR-аар харах"}
      </button>
      {message && (
        <p role="status" aria-live="polite">
          {message}
        </p>
      )}
      {source && (
        <div
          className="km-ar-dialog"
          role="dialog"
          aria-modal="true"
          aria-label={`${name} AR харах`}
        >
          <button
            type="button"
            className="km-ar-close"
            onClick={close}
            aria-label="AR цонх хаах"
          >
            <X size={20} />
          </button>
          <model-viewer
            ref={(element: HTMLElement | null) => {
              viewer.current = element as ModelViewerElement | null;
            }}
            src={source}
            alt={`${name} 3D загвар`}
            ar=""
            ar-modes="webxr scene-viewer quick-look"
            camera-controls=""
            shadow-intensity="1"
            exposure="1"
            interaction-prompt="auto"
            style={{ width: "100%", height: "100%" }}
          />
          <button
            type="button"
            className="km-ar-launch"
            onClick={() => void launchAR()}
          >
            <Box size={18} />
            Өрөөндөө байрлуулж үзэх
          </button>
        </div>
      )}
    </>
  );
}
