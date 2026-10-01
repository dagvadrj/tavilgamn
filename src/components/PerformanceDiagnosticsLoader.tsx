"use client";

import { useEffect, useState, type ComponentType } from "react";
import { performanceDiagnosticsEnabled } from "@/lib/performanceDiagnostics";

export function PerformanceDiagnosticsLoader() {
  const [Panel, setPanel] = useState<ComponentType | null>(null);
  useEffect(() => {
    if (!performanceDiagnosticsEnabled()) return;
    let cancelled = false;
    void import("./PerformanceDiagnostics").then(module => {
      if (!cancelled) setPanel(() => module.PerformanceDiagnostics);
    });
    return () => { cancelled = true; };
  }, []);
  return Panel ? <Panel /> : null;
}
