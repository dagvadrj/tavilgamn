"use client";

import { useEffect, useState } from "react";

type ConnectionInfo = {
  saveData?: boolean;
  effectiveType?: string;
};

type NavigatorWithDeviceInfo = Navigator & {
  deviceMemory?: number;
  connection?: ConnectionInfo;
};

export type CanvasPerformance = {
  dpr: number | [number, number];
  shadows: boolean;
  contactShadows: boolean;
  autoRotate: boolean;
};

export function selectCanvasPerformance(input: {
  narrow: boolean;
  reducedMotion: boolean;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  saveData?: boolean;
  effectiveType?: string;
}): CanvasPerformance {
  const constrained =
    input.narrow ||
    input.saveData === true ||
    input.effectiveType === "2g" ||
    (input.hardwareConcurrency !== undefined && input.hardwareConcurrency <= 4) ||
    (input.deviceMemory !== undefined && input.deviceMemory <= 4);

  return {
    dpr: constrained ? 1 : [1, 1.5],
    shadows: !constrained,
    contactShadows: !constrained,
    autoRotate: !input.reducedMotion && !constrained,
  };
}

const DESKTOP_DEFAULT: CanvasPerformance = {
  dpr: [1, 1.5],
  shadows: true,
  contactShadows: true,
  autoRotate: true,
};

export function useCanvasPerformance() {
  const [quality, setQuality] = useState<CanvasPerformance>(DESKTOP_DEFAULT);

  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 767px)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const nav = navigator as NavigatorWithDeviceInfo;

    const update = () => {
      setQuality(
        selectCanvasPerformance({
          narrow: narrow.matches,
          reducedMotion: reducedMotion.matches,
          hardwareConcurrency: nav.hardwareConcurrency,
          deviceMemory: nav.deviceMemory,
          saveData: nav.connection?.saveData,
          effectiveType: nav.connection?.effectiveType,
        }),
      );
    };

    update();
    narrow.addEventListener("change", update);
    reducedMotion.addEventListener("change", update);
    return () => {
      narrow.removeEventListener("change", update);
      reducedMotion.removeEventListener("change", update);
    };
  }, []);

  return quality;
}
