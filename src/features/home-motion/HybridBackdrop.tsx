"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { HYBRID_ROOMS, hybridCrop } from "./hybridRooms";

const SIZES = "(max-aspect-ratio: 1/1) 180vh, 100vw";

export function HybridBackdrop({
  phase,
  poster,
  scene,
  customPoster,
  onImageReady,
}: {
  phase: number;
  poster: boolean;
  /** The WebGL scene is mounting: only then is the backplate under it needed. */
  scene: boolean;
  customPoster?: string;
  onImageReady: (phase: number) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  // Rooms load as the tour reaches them, plus the next one so its fade is
  // ready. Hidden rooms are still "in the viewport" (opacity 0), so lazy
  // loading alone fetched every photo on the first paint.
  const [reached, setReached] = useState(phase);
  useEffect(() => setReached((value) => Math.max(value, phase)), [phase]);
  const rendered = (i: number) => i <= reached + 1;
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const resize = () => {
      HYBRID_ROOMS.forEach((room, i) => {
        const c = hybridCrop(node.clientWidth, node.clientHeight, room);
        const image = node.children[i]?.querySelector<HTMLElement>(
          "[data-backplate]",
        );
        if (image)
          // Offset with a transform: the crop applies after hydration, and moving
          // left/top then counted as a layout shift of the whole hero (CLS ≈ 0.96).
          Object.assign(image.style, {
            width: `${c.fullWidth * c.scale}px`,
            height: `${c.fullHeight * c.scale}px`,
            transform: `translate(${-c.x * c.scale}px, ${-c.y * c.scale}px)`,
          });
      });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    resize();
    return () => observer.disconnect();
  }, [scene, reached]);
  return (
    <div ref={root} className="hybrid-backdrop" aria-hidden="true">
      {HYBRID_ROOMS.map((room, i) => (
        <div
          key={room.id}
          className="hybrid-backplate"
          data-active={i === phase}
        >
          <div className="hybrid-photo-frame">
            {scene && rendered(i) && (
              <Image
                src={room.image}
                onLoad={() => onImageReady(i)}
                alt=""
                fill
                sizes={SIZES}
                priority={i === 0}
                data-backplate=""
              />
            )}
            {poster && rendered(i) && (
              <Image
                src={
                  i === 0 && customPoster
                    ? customPoster
                    : `/interior/hybrid/${room.id}-poster.webp`
                }
                alt=""
                fill
                sizes={SIZES}
                priority={i === 0}
                data-homepage-field={i === 0 ? "image" : undefined}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
