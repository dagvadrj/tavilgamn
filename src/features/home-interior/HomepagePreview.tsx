"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PreviewContent from "./HomepagePreviewContent";
import { Monitor, Smartphone, RotateCcw } from "lucide-react";
import type { HomepageHero } from "@/lib/homepagePresentation";

const PREVIEW_DOCUMENT =
  '<!doctype html><html lang="mn" data-homepage-preview="true"><head><meta charset="utf-8"><style>body{margin:0}html{scrollbar-width:thin}</style></head><body></body></html>';

/** A separate document isolates the storefront CSS and its responsive breakpoints. */
export function HomepagePreview({
  owner,
  hero,
  productIds,
  onSelect,
  onProducts,
}: {
  owner: string;
  hero: HomepageHero;
  productIds: string[];
  onSelect: (field: string) => void;
  onProducts: (products: { id: string; name: string }[]) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const [body, setBody] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState(700);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const node = container.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!previewDocument) return;
    const doc = previewDocument;
    let active = true;
    const syncStyles = () => {
      const stylesReady: Promise<void>[] = [];
      doc
        .querySelectorAll("[data-preview-style]")
        .forEach((node) => node.remove());
      document
        .querySelectorAll('link[rel="stylesheet"], style')
        .forEach((node) => {
          const clone = node.cloneNode(true) as HTMLElement;
          clone.dataset.previewStyle = "true";
          if (clone.tagName === "LINK") {
            stylesReady.push(
              new Promise<void>((resolve) => {
                clone.addEventListener("load", () => resolve(), { once: true });
                clone.addEventListener("error", () => resolve(), {
                  once: true,
                });
              }),
            );
          }
          doc.head.appendChild(clone);
        });
      doc.documentElement.className = document.documentElement.className;
      doc.body.className = document.body.className;
      void Promise.all(stylesReady).then(() => {
        if (active) setBody(doc.body);
      });
    };
    syncStyles();
    const observer = new MutationObserver(syncStyles);
    observer.observe(document.head, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [previewDocument]);
  const viewportWidth = device === "mobile" ? 390 : 1280;
  const scale = Math.min(1, width / viewportWidth);
  return (
    <section
      className="homepage-preview"
      aria-label="Нүүр хуудасны шууд урьдчилсан харагдац"
    >
      <div className="homepage-preview-toolbar">
        <strong>Шууд харагдац</strong>
        <div role="group" aria-label="Харах төхөөрөмж">
          <button
            type="button"
            aria-label="Компьютер"
            aria-pressed={device === "desktop"}
            onClick={() => setDevice("desktop")}
          >
            <Monitor size={17} />
          </button>
          <button
            type="button"
            aria-label="Утас"
            aria-pressed={device === "mobile"}
            onClick={() => setDevice("mobile")}
          >
            <Smartphone size={17} />
          </button>
          <button
            type="button"
            aria-label="Preview дахин ачаалах"
            onClick={() => setRevision((v) => v + 1)}
          >
            <RotateCcw size={17} />
          </button>
        </div>
      </div>
      <p className="homepage-preview-hint">
        Гарчиг, тайлбар эсвэл товч дээр дарж засах талбараа сонгоно. 3D
        үзүүлбэрийг шууд туршиж болно.
      </p>
      <div ref={container} className="homepage-preview-stage">
        <div style={{ width: viewportWidth * scale, height: 800 * scale }}>
          <iframe
            ref={frame}
            title="Нүүр хуудасны интерактив preview"
            srcDoc={PREVIEW_DOCUMENT}
            onLoad={() =>
              setPreviewDocument(frame.current?.contentDocument ?? null)
            }
            style={{
              width: viewportWidth,
              height: 800,
              transform: `scale(${scale})`,
            }}
          />
        </div>
      </div>
      {body &&
        createPortal(
          <PreviewContent
            key={revision}
            owner={owner}
            hero={hero}
            productIds={productIds}
            onSelect={onSelect}
            onProducts={onProducts}
          />,
          body,
        )}
    </section>
  );
}
