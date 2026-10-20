"use client";

import { useEffect, useId, useRef } from "react";
import {
  prepareDashboardFields,
  revealDashboardField,
} from "./dashboardFormUx";
import "./dashboard-forms.css";

/** Applies to every form in either dashboard, including newly opened editors. */
export function DashboardFormAssist() {
  const marker = useRef<HTMLSpanElement>(null);
  const prefix = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  useEffect(() => {
    const root = marker.current?.closest<HTMLElement>(".dashboard-shell");
    if (!root) return;
    const prepare = () =>
      prepareDashboardFields(root, `dashboard-field-${prefix}`);
    const invalid = (event: Event) => {
      if (event.target instanceof Element) revealDashboardField(event.target);
    };
    prepare();
    root.addEventListener("invalid", invalid, true);
    let frame = 0;
    const observer = new MutationObserver((records) => {
      const relevant = records.some(
        (record) =>
          record.type === "attributes" ||
          (record.target instanceof Element && record.target.closest("form")) ||
          [...record.addedNodes].some(
            (node) =>
              node instanceof Element &&
              (node.matches('form,input,select,textarea,[role="alert"]') ||
                node.querySelector(
                  'form,input,select,textarea,[role="alert"]',
                )),
          ),
      );
      if (relevant && !frame)
        frame = requestAnimationFrame(() => {
          frame = 0;
          prepare();
        });
    });
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-invalid"],
    });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      root.removeEventListener("invalid", invalid, true);
    };
  }, [prefix]);
  return <span ref={marker} hidden />;
}
