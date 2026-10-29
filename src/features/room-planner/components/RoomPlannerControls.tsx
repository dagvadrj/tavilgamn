"use client";

import { useCallback, useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { RoomLighting, RoomCeiling } from "@/lib/types";
import { DEFAULT_ROOM_LIGHTING } from "@/lib/roomDesign";
import { RoomLightingTimeControls } from "./RoomLightingTimeControls";
import { Image as ImageIcon, Lightbulb, PanelsTopLeft, X, Box, ChevronDown, Camera, Eye, Focus, Grid2X2, HelpCircle, Lock, Magnet, Maximize, Minus, MoreHorizontal, PencilRuler, Plus, RotateCcw, RotateCw, Ruler, Unlock } from "lucide-react";

export type RoomView = "dollhouse" | "top" | "front" | "back" | "left" | "right" | "interior";
const SIDE_VIEWS = [
  ["front", "Урд тал"], ["back", "Ар тал"], ["left", "Зүүн тал"], ["right", "Баруун тал"],
] as const;

export function RoomPlannerControls({ onCover, roomActive, view, onView, onZoom, onRoom,
  onHelp, onWindows, dimensions, onDimensions, grid, onGrid, snap, onSnap, locked, onLock,
  expanded, onExpand, onRotate, lighting, ceiling, windowBearing, onLightingChange, onLightingSettings, beginLightingEdit, endLightingEdit,
}: {
  /** «Өрөө ба материал» is a nested view of the left panel. */
  roomActive?: boolean;
  /** Merchant editor (C3): «Cover болгох» from the current view. */
  onCover?: () => void;
  windowBearing?: number; ceiling?: RoomCeiling; lighting?: RoomLighting; onLightingChange?: (patch: Partial<RoomLighting>) => void; onLightingSettings?: () => void;
  beginLightingEdit?: () => void; endLightingEdit?: () => void;
  view: RoomView; onView: (view: RoomView) => void;
  onZoom: (action: "zoom-in" | "zoom-out" | "fit") => void;
  onWindows?: () => void;
  onRoom: () => void; onHelp: () => void;
  dimensions: boolean; onDimensions: () => void;
  grid: boolean; onGrid: () => void; snap: boolean; onSnap: () => void;
  locked: boolean; onLock: () => void; expanded: boolean; onExpand: () => void;
  onRotate: (action: "rotate-left" | "rotate-right") => void;
}) {
  const dock = useRef<HTMLElement>(null);
  const lightMenu = useRef<HTMLDetailsElement>(null);
  const sideMenu = useRef<HTMLDetailsElement>(null);
  const positionLights = useCallback(() => {
    const menu = lightMenu.current;
    if (!menu?.open) return;
    const anchor = menu.querySelector("summary")!.getBoundingClientRect();
    const right = Math.max(12, anchor.left - 12);
    const width = Math.min(320, Math.max(0, right - 12));
    menu.style.setProperty("--room-light-menu-left", `${Math.max(12, right - width)}px`);
    menu.style.setProperty("--room-light-menu-width", `${width}px`);
  }, []);
  const positionMenu = useCallback((menu: HTMLDetailsElement) => {
    if (!menu.open || !dock.current) return;
    const anchor = menu.querySelector("summary")!.getBoundingClientRect();
    const bar = dock.current.getBoundingClientRect();
    const width = Math.min(280, window.innerWidth - 24);
    menu.style.setProperty("--room-menu-left", `${Math.max(12, Math.min(anchor.right - width, window.innerWidth - width - 12))}px`);
    menu.style.setProperty("--room-menu-bottom", `${window.innerHeight - bar.top + 10}px`);
    menu.style.setProperty("--room-menu-height", `${Math.max(80, bar.top - 24)}px`);
  }, []);
  const toggleMenu = (menu: HTMLDetailsElement) => {
    if (!menu.open) return;
    dock.current?.querySelectorAll<HTMLDetailsElement>("details[open]").forEach(other => {
      if (other !== menu) other.open = false;
    });
    positionMenu(menu);
  };
  const activeSide = SIDE_VIEWS.find(([side]) => side === view);
  /** Arrow keys, Home and End move between the four sides; Escape is handled below. */
  const moveSideFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'));
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
    const next = step !== undefined ? (current + step + items.length) % items.length
      : event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    items[next]?.focus();
  };
  const closeLights = () => { if (lightMenu.current) { lightMenu.current.open = false; lightMenu.current.querySelector("summary")?.focus(); } endLightingEdit?.(); };
  useEffect(() => {
    const dismiss = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      const menus = Array.from(dock.current?.querySelectorAll<HTMLDetailsElement>("details[open]") ?? []);
      if (lightMenu.current?.open) menus.push(lightMenu.current);
      menus.forEach(menu => {
        if (event instanceof KeyboardEvent || !menu.contains(event.target as Node)) {
          menu.open = false;
          if (event instanceof KeyboardEvent) menu.querySelector("summary")?.focus();
        }
      });
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", dismiss);
    const reposition = () => {
      dock.current?.querySelectorAll<HTMLDetailsElement>("details[open]").forEach(positionMenu);
      positionLights();
    };
    const observer = new ResizeObserver(reposition);
    const bar = dock.current;
    if (bar) observer.observe(bar);
    window.addEventListener("resize", reposition);
    bar?.addEventListener("scroll", reposition);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", dismiss);
      observer.disconnect();
      window.removeEventListener("resize", reposition);
      bar?.removeEventListener("scroll", reposition);
    };
  }, [positionMenu, positionLights]);
  return <>
    <div className="room-zoom-controls" role="group" aria-label="Өрөөг ойртуулах, холдуулах">
      <button type="button" aria-label="Ойртуулах" title="Ойртуулах" disabled={locked} onClick={() => onZoom("zoom-in")}><Plus size={22}/></button>
      <button type="button" aria-label="Өрөөг бүтнээр харах" title="Өрөөг бүтнээр харах" disabled={locked} onClick={() => onZoom("fit")}><Focus size={19}/></button>
      <button type="button" aria-label="Холдуулах" title="Холдуулах" disabled={locked} onClick={() => onZoom("zoom-out")}><Minus size={22}/></button>
    </div>
    <div className="room-scene-light-anchor">
        <details className="room-scene-lighting" ref={lightMenu} onToggle={event => { if (event.currentTarget.open) positionLights(); else endLightingEdit?.(); }}>
          <summary aria-label="Гэрлийн тохиргоо" title="Гэрэлтүүлэг"><Lightbulb size={21}/></summary>
          <div className="room-lighting-popup" role="dialog" aria-label="Гэрлийн тохиргоо">
            <div className="room-lighting-popup-header"><strong><Lightbulb size={18}/> Гэрэлтүүлэг</strong><button type="button" aria-label="Гэрлийн тохиргоог хаах" onClick={closeLights}><X size={16}/></button></div>
            <RoomLightingTimeControls windowBearing={windowBearing} ceiling={ceiling} lighting={lighting ?? DEFAULT_ROOM_LIGHTING} onChange={patch=>onLightingChange?.(patch)} beginEdit={()=>beginLightingEdit?.()} endEdit={()=>endLightingEdit?.()} showIntensity />
            <button type="button" className="room-lighting-more" onClick={()=>{closeLights();onLightingSettings?.();}}>Гэрлийн дэлгэрэнгүй тохиргоо</button>
          </div>
        </details>
    </div>
    {(locked || !snap) && <div className="room-navigation-status" role="group" aria-label="Идэвхтэй удирдлага">
        {locked && <button type="button" onClick={onLock}><Lock size={14}/> Камер түгжээтэй · Тайлах</button>}
        {!snap && <button type="button" aria-pressed={snap} onClick={onSnap}><Magnet size={14}/> Хананд тааруулах унтарсан · Асаах</button>}
    </div>}
    <nav className="room-view-dock" ref={dock} aria-label="Өрөө харах, засах">
      <div className="room-view-options" role="group" aria-label="Харах өнцөг" data-planner-tour="room-view">
        <button type="button" aria-pressed={view === "dollhouse"} onClick={() => onView("dollhouse")}><Box size={20}/><span>Гаднаас</span></button>
        <button type="button" aria-pressed={view === "top"} onClick={() => onView("top")}><Grid2X2 size={20}/><span>Дээрээс</span></button>
        <details className="room-dock-more room-side-views" ref={sideMenu} onToggle={event => {
          const menu = event.currentTarget;
          toggleMenu(menu);
          // B2.6: the opened menu takes focus on the active side, or on «Урд тал».
          if (menu.open) (menu.querySelector<HTMLButtonElement>('[aria-checked="true"]') ?? menu.querySelector<HTMLButtonElement>('[role="menuitemradio"]'))?.focus?.();
        }}>
          <summary aria-label={activeSide ? `Хажуугаас харах · ${activeSide[1]}` : "Хажуугаас харах"} aria-haspopup="menu" data-active={!!activeSide}><Eye size={20}/><span>{activeSide ? `Хажуугаас · ${activeSide[1].replace(" тал", "")}` : "Хажуугаас"}</span><ChevronDown size={12}/></summary>
          <div className="room-dock-popover" role="menu" aria-label="Харах талаа сонгох" onKeyDown={moveSideFocus}>
            {SIDE_VIEWS.map(([side, label]) => <button type="button" role="menuitemradio" key={side} aria-checked={view === side} tabIndex={view === side || (!activeSide && side === "front") ? 0 : -1} onClick={() => {
              onView(side);
              if (sideMenu.current) { sideMenu.current.open = false; sideMenu.current.querySelector("summary")?.focus(); }
            }}>{label}</button>)}
          </div>
        </details>
        <button type="button" aria-pressed={view === "interior"} onClick={() => onView("interior")}><Camera size={20}/><span>Дотроос</span></button>
      </div>
      <span className="room-dock-divider" aria-hidden="true" />
      <button type="button" className="room-dock-room" aria-pressed={!!roomActive} onClick={onRoom} data-planner-tour="room-size"><PencilRuler size={20}/><span>Өрөө ба материал</span></button>
      {onCover && <button type="button" className="room-dock-cover" onClick={onCover}><ImageIcon size={20}/><span>Cover болгох</span></button>}
      <div className="room-dock-edit">
        <details className="room-dock-more" onToggle={event => toggleMenu(event.currentTarget)}>
          <summary aria-label="Нэмэлт удирдлага"><MoreHorizontal size={22}/><ChevronDown size={12}/></summary>
          <div className="room-dock-popover">
            <button type="button" aria-pressed={dimensions} onClick={onDimensions}><Ruler size={17}/> Хэмжээс</button>
            <button type="button" onClick={onWindows}><PanelsTopLeft size={17}/> Цонх</button>
            <p>Харах өнцгийг эргүүлэх</p>
            <div className="room-dock-rotate">
              <button type="button" disabled={locked || view === "top"} onClick={() => onRotate("rotate-left")}><RotateCcw size={17}/> Зүүн</button>
              <button type="button" disabled={locked || view === "top"} onClick={() => onRotate("rotate-right")}><RotateCw size={17}/> Баруун</button>
            </div>
            <button type="button" aria-pressed={grid} onClick={onGrid}><Grid2X2 size={17}/> 25 см тор</button>
            <button type="button" aria-pressed={snap} onClick={onSnap}><Magnet size={17}/> Хананд тааруулах</button>
            <button type="button" aria-pressed={locked} onClick={onLock}>{locked ? <Lock size={17}/> : <Unlock size={17}/>} Камер түгжих</button>
            <button type="button" aria-pressed={expanded} onClick={onExpand}><Maximize size={17}/> Дэлгэц дүүргэх</button>
            <button type="button" onClick={onHelp}><HelpCircle size={17}/> Хэрхэн ашиглах вэ?</button>
          </div>
        </details>
      </div>
    </nav>
  </>;
}
