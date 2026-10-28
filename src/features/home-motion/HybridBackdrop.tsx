"use client";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { HYBRID_ROOMS, hybridCrop } from "./hybridRooms";

export function HybridBackdrop({
  phase,
  poster,
  customPoster,
  onImageReady,
}: {
  phase: number;
  poster: boolean;
  customPoster?: string;
  onImageReady: (phase: number) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const resize = () => {
      HYBRID_ROOMS.forEach((room, i) => {
        const c = hybridCrop(node.clientWidth, node.clientHeight, room);
        const image = node.children[i]?.firstElementChild as HTMLElement | null;
        if (image)
          Object.assign(image.style, {
            width: `${c.fullWidth * c.scale}px`,
            height: `${c.fullHeight * c.scale}px`,
            left: `${-c.x * c.scale}px`,
            top: `${-c.y * c.scale}px`,
          });
      });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    resize();
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={root} className="hybrid-backdrop" aria-hidden="true">
      {HYBRID_ROOMS.map((room, i) => (
        <div
          key={room.id}
          className="hybrid-backplate"
          data-active={i === phase}
        >
          <div className="hybrid-photo-frame">
            <Image
              src={room.image}
              onLoad={() => onImageReady(i)}
              alt=""
              fill
              sizes="(max-aspect-ratio: 1/1) 180vh, 100vw"
              priority={i === 0}
              quality={90}
            />
            {poster && (
              <Image
                src={
                  i === 0 && customPoster
                    ? customPoster
                    : `/interior/hybrid/${room.id}-poster.webp`
                }
                alt=""
                fill
                sizes="(max-aspect-ratio: 1/1) 180vh, 100vw"
                priority={i === 0}
                quality={90}
                data-homepage-field={i === 0 ? "image" : undefined}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
