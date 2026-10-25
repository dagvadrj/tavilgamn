"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/** Native modal behavior keeps the mobile menu keyboard- and screen-reader-safe. */
export function DashboardSidebar({
  children,
  open,
  onClose,
  label,
  id,
}: {
  children: ReactNode;
  open: boolean;
  onClose: () => void;
  label: string;
  id: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [tooltip, setTooltip] = useState<{
    label: string;
    top: number;
    left: number;
  } | null>(null);
  const showTooltip = (event: SyntheticEvent<HTMLElement>) => {
    if (!window.matchMedia("(min-width: 1024px) and (hover: hover)").matches)
      return;
    const target = (event.target as Element).closest<HTMLElement>(
      "button[aria-label], a[aria-label]",
    );
    if (!target || !event.currentTarget.contains(target)) {
      setTooltip(null);
      return;
    }
    const rect = target.getBoundingClientRect();
    setTooltip({
      label: target.getAttribute("aria-label") ?? "",
      top: Math.max(
        24,
        Math.min(window.innerHeight - 24, rect.top + rect.height / 2),
      ),
      left: event.currentTarget.getBoundingClientRect().right + 8,
    });
  };

  useEffect(() => {
    if (!tooltip) return;
    const dismiss = () => setTooltip(null);
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", escape);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      window.removeEventListener("keydown", escape);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [tooltip]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!open) {
      if (dialog.open) dialog.close();
      return;
    }
    const desktop = window.matchMedia("(min-width: 1024px)");
    if (desktop.matches) {
      onClose();
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!dialog.open) dialog.showModal();
    const closeOnDesktop = () => {
      if (desktop.matches) onClose();
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => {
      desktop.removeEventListener("change", closeOnDesktop);
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
    };
  }, [open, onClose]);

  return (
    <>
      <aside
        className="dashboard-sidebar"
        aria-label={label}
        onPointerOver={showTooltip}
        onPointerLeave={() => setTooltip(null)}
        onFocusCapture={showTooltip}
        onBlurCapture={() => setTooltip(null)}
        onClick={() => setTooltip(null)}
      >
        {children}
      </aside>
      {tooltip &&
        createPortal(
          <div
            className="dashboard-nav-tooltip"
            aria-hidden="true"
            style={{ top: tooltip.top, left: tooltip.left }}
          >
            {tooltip.label}
          </div>,
          document.body,
        )}
      <dialog
        id={id}
        ref={dialogRef}
        className="dashboard-drawer"
        aria-label={label}
        onCancel={(event) => {
          event.preventDefault();
          onClose();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <div className="dashboard-drawer-content">
          <button
            type="button"
            className="dashboard-drawer-close"
            aria-label="Цэс хаах"
            onClick={onClose}
          >
            <X size={20} />
          </button>
          {children}
        </div>
      </dialog>
    </>
  );
}
