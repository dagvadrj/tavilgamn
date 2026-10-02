"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/** Native modal behavior keeps the mobile menu keyboard- and screen-reader-safe. */
export function DashboardSidebar({ children, open, onClose, label, id }: {
  children: ReactNode;
  open: boolean;
  onClose: () => void;
  label: string;
  id: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

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
    const closeOnDesktop = () => { if (desktop.matches) onClose(); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => {
      desktop.removeEventListener("change", closeOnDesktop);
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
    };
  }, [open, onClose]);

  return <>
    <aside className="dashboard-sidebar" aria-label={label}>{children}</aside>
    <dialog id={id} ref={dialogRef} className="dashboard-drawer" aria-label={label}
      onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="dashboard-drawer-content">
        <button type="button" className="dashboard-drawer-close" aria-label="Цэс хаах" onClick={onClose}><X size={20} /></button>
        {children}
      </div>
    </dialog>
  </>;
}
