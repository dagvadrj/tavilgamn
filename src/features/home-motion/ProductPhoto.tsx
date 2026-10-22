"use client";

import Image from "next/image";
import { Armchair } from "lucide-react";
import { useState } from "react";

export function ProductPhoto({
  src,
  alt,
  priority = false,
}: {
  src?: string;
  alt: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <span className="home-product-photo">
      {src &&
      src !== failed &&
      !/\/(?:image|placeholder)\.(?:png|webp)$/.test(src) ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 700px) 75vw, 400px"
          unoptimized
          priority={priority}
          onError={() => setFailed(src)}
        />
      ) : (
        <Armchair size={72} strokeWidth={1} aria-hidden="true" />
      )}
    </span>
  );
}
