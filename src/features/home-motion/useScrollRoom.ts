"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ROOM_STEPS,
  roomScrollProgress,
  scrollRoomPose,
  type RoomMotion,
} from "./scrollRoomStory";

export function useScrollRoom() {
  const root = useRef<HTMLElement>(null),
    stage = useRef<HTMLDivElement>(null);
  const motion = useRef<RoomMotion>({
    progress: 0,
    visible: true,
    paused: false,
    snap: true,
  });
  const [phase, setPhase] = useState(0),
    [reduced, setReduced] = useState(false),
    [paused, setPaused] = useState(false);
  const [mounted, setMounted] = useState(false);
  const apply = useCallback((p: number) => {
    motion.current.progress = p;
    setPhase(scrollRoomPose(p).phase);
    motion.current.invalidate?.();
  }, []);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => {
      setReduced(preference.matches);
      motion.current.snap = true;
    };
    change();
    preference.addEventListener("change", change);
    return () => preference.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    motion.current.paused = paused;
    const node = root.current,
      viewport = stage.current;
    if (!node || !viewport) return;
    const header = document.querySelector<HTMLElement>(".store-header");
    header?.setAttribute("data-room-tour", "true");
    const wasInert = header?.inert ?? false;
    let frame = 0,
      lastY = window.scrollY,
      directionY = lastY,
      headerHeight = 0;
    const showHeader = () => {
      header?.removeAttribute("data-room-hidden");
      if (header) header.inert = wasInert;
    };
    const measure = () => {
      headerHeight =
        header &&
        ["sticky", "fixed"].includes(getComputedStyle(header).position)
          ? header.offsetHeight
          : 0;
      node.style.setProperty("--room-header-height", `${headerHeight}px`);
      queue();
    };
    const update = () => {
      frame = 0;
      const rect = node.getBoundingClientRect(),
        y = window.scrollY;
      const inside =
        rect.top < headerHeight - 8 && rect.bottom > window.innerHeight + 4;
      if (
        !inside ||
        reduced ||
        y < lastY - 2 ||
        header?.contains(document.activeElement)
      ) {
        showHeader();
        directionY = y;
      } else if (header && y > directionY + 12 && y > lastY) {
        header.dataset.roomHidden = "true";
        header.inert = true;
      }
      lastY = y;
      if (!paused && !reduced)
        apply(
          roomScrollProgress(rect.top, rect.height, viewport.clientHeight, 0),
        );
    };
    const queue = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const visibility = () => {
      motion.current.visible =
        !document.hidden &&
        viewport.getBoundingClientRect().bottom > 0 &&
        viewport.getBoundingClientRect().top < window.innerHeight;
      if (motion.current.visible) motion.current.invalidate?.();
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        motion.current.visible = entry.isIntersecting && !document.hidden;
        if (entry.isIntersecting) {
          setMounted(true);
          queue();
          motion.current.invalidate?.();
        }
      },
      { rootMargin: "100px" },
    );
    observer.observe(viewport);
    const resize = new ResizeObserver(measure);
    if (header) resize.observe(header);
    resize.observe(viewport);
    measure();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", measure);
    document.addEventListener("visibilitychange", visibility);
    header?.addEventListener("focusin", showHeader);
    return () => {
      observer.disconnect();
      resize.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", measure);
      document.removeEventListener("visibilitychange", visibility);
      header?.removeEventListener("focusin", showHeader);
      showHeader();
      header?.removeAttribute("data-room-tour");
    };
  }, [apply, paused, reduced]);
  const choose = (index: number) => {
    const p = index === -1 ? 0 : ROOM_STEPS[index];
    if (p === undefined) return;
    setPaused(false);
    motion.current.paused = false;
    if (reduced) {
      motion.current.snap = true;
      apply(p);
      return;
    }
    const node = root.current,
      viewport = stage.current;
    if (!node || !viewport) return;
    // Direct navigation selects the same physical point as scrolling; no competing autoplay.
    window.scrollTo({
      top:
        window.scrollY +
        node.getBoundingClientRect().top +
        p * (node.offsetHeight - viewport.clientHeight),
      behavior: "instant",
    });
    apply(p);
  };
  const skip = () => {
    if (root.current)
      window.scrollTo({
        top:
          window.scrollY +
          root.current.getBoundingClientRect().bottom -
          (parseFloat(
            root.current.style.getPropertyValue("--room-header-height"),
          ) || 0),
        behavior: reduced ? "instant" : "smooth",
      });
  };
  return {
    root,
    stage,
    motion,
    phase,
    reduced,
    paused,
    mounted,
    choose,
    skip,
    toggle: () => setPaused((value) => !value),
  };
}
