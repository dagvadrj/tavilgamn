"use client";

import { useEffect, useId, useRef, type PointerEvent, type ReactNode } from "react";
import "./kitchen-component-sheet.css";

export interface KitchenComponentSheetProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
}

/** Native modal focus handling, with a compact sheet on phones and a side panel on desktop. */
export function KitchenComponentSheet({ title, children, onClose }: KitchenComponentSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const closeCallback = useRef(onClose);
  closeCallback.current = onClose;
  const closing = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backdropStart = useRef(false);
  const drag = useRef<{ id: number; startY: number; distance: number } | null>(null);
  const suppressHandleClick = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const previousPadding = document.body.style.paddingRight;
    const scrollbar = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    if (scrollbar) document.body.style.paddingRight = `${(parseFloat(getComputedStyle(document.body).paddingRight) || 0) + scrollbar}px`;
    document.body.style.overflow = "hidden";
    closing.current = false;
    dialog.showModal();
    headingRef.current?.focus({ preventScroll: true });
    return () => {
      if (closeTimer.current !== null) clearTimeout(closeTimer.current);
      dialog.close();
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPadding;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  // Category changes keep the same dialog open, announcing the newly selected part.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [title]);

  function requestClose() {
    if (closing.current) return;
    closing.current = true;
    dialogRef.current?.setAttribute("data-closing", "true");
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180;
    closeTimer.current = setTimeout(() => closeCallback.current(), delay);
  }

  function outsideDialog(x: number, y: number) {
    const rect = dialogRef.current?.getBoundingClientRect();
    return !!rect && (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom);
  }

  function resetDrag() {
    drag.current = null;
    dialogRef.current?.removeAttribute("data-dragging");
    dialogRef.current?.style.removeProperty("--kcs-drag-y");
  }

  function startDrag(event: PointerEvent<HTMLButtonElement>) {
    if (closing.current || event.button !== 0 || drag.current || !window.matchMedia("(max-width: 760px)").matches) return;
    suppressHandleClick.current = false;
    drag.current = { id: event.pointerId, startY: event.clientY, distance: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
    dialogRef.current?.setAttribute("data-interacted", "true");
    dialogRef.current?.setAttribute("data-dragging", "true");
  }

  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    current.distance = Math.max(0, event.clientY - current.startY);
    if (Math.abs(event.clientY - current.startY) > 5) suppressHandleClick.current = true;
    dialogRef.current?.style.setProperty("--kcs-drag-y", `${current.distance}px`);
  }

  function endDrag(event: PointerEvent<HTMLButtonElement>, cancelled = false) {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const distance = Math.max(0, event.clientY - current.startY);
    if (Math.abs(event.clientY - current.startY) > 5 || cancelled) suppressHandleClick.current = true;
    resetDrag();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!cancelled && distance >= 80) requestClose();
  }

  return <dialog ref={dialogRef} className="kcs-sheet" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); requestClose(); }}
    onPointerDown={event => { backdropStart.current = event.target === event.currentTarget && outsideDialog(event.clientX, event.clientY); }}
    onClick={event => {
      if (event.target === event.currentTarget && backdropStart.current && outsideDialog(event.clientX, event.clientY)) requestClose();
      backdropStart.current = false;
    }}>
    <button type="button" className="kcs-grip" aria-label="Доош чирж эсвэл дарж хаах"
      onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={event => endDrag(event)}
      onPointerCancel={event => endDrag(event, true)} onLostPointerCapture={() => { if (drag.current) { suppressHandleClick.current = true; resetDrag(); } }}
      onClick={() => { if (suppressHandleClick.current) { suppressHandleClick.current = false; return; } requestClose(); }}>
      <span aria-hidden="true" />
    </button>
    <header className="kcs-header">
      <div><p className="kcs-eyebrow">БҮРЭЛДЭХҮҮН ХЭСЭГ</p><h2 ref={headingRef} id={titleId} tabIndex={-1}>{title}</h2></div>
      <button type="button" className="kcs-close" aria-label="Хаах" onClick={requestClose}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
      </button>
    </header>
    <div className="kcs-content">{children}</div>
  </dialog>;
}
