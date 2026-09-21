"use client";

import { useEffect, useRef, useState } from "react";
import { Box, Loader2, X } from "lucide-react";
import type { Group } from "three";

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
}: {
  root: Group | null;
  name: string;
  disabled: boolean;
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
    setMessage("");
    try {
      await import("@google/model-viewer");
      const { encodeKitchenGlb } = await import("@/three/kitchenExport");
      const data = await encodeKitchenGlb(root);
      const nextSource = URL.createObjectURL(
        new Blob([data], { type: "model/gltf-binary" }),
      );
      setSource(previous => {
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
    }
  }

  function close() {
    setSource(previous => {
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
        <div className="km-ar-dialog" role="dialog" aria-modal="true" aria-label={`${name} AR харах`}>
          <button type="button" className="km-ar-close" onClick={close} aria-label="AR цонх хаах">
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