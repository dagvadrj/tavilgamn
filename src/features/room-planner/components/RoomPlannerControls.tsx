"use client";

import { useEffect, useRef } from "react";
import type { RoomLighting, RoomCeiling } from "@/lib/types";
import { DEFAULT_ROOM_LIGHTING } from "@/lib/roomDesign";
import { RoomLightingTimeControls } from "./RoomLightingTimeControls";
import { Lightbulb, PanelsTopLeft, X, Box, ChevronDown, Eye, Focus, Grid2X2, HelpCircle, Lock, Magnet, Maximize, Minus, MoreHorizontal, Paintbrush, PencilRuler, Plus, RotateCcw, RotateCw, Ruler, Unlock } from "lucide-react";

export type RoomView = "dollhouse" | "top" | "front";

export function RoomPlannerControls({ view, onView, onZoom, onRoom, onMaterials,
  onHelp, onWindows, dimensions, onDimensions, grid, onGrid, snap, onSnap, locked, onLock,
  expanded, onExpand, onRotate, lighting, ceiling, windowBearing, onLightingChange, onLightingSettings, beginLightingEdit, endLightingEdit,
}: {
  windowBearing?: number; ceiling?: RoomCeiling; lighting?: RoomLighting; onLightingChange?: (patch: Partial<RoomLighting>) => void; onLightingSettings?: () => void;
  beginLightingEdit?: () => void; endLightingEdit?: () => void;
  view: RoomView; onView: (view: RoomView) => void;
  onZoom: (action: "zoom-in" | "zoom-out" | "fit") => void;
  onWindows?: () => void;
  onRoom: () => void; onMaterials: () => void; onHelp: () => void;
  dimensions: boolean; onDimensions: () => void;
  grid: boolean; onGrid: () => void; snap: boolean; onSnap: () => void;
  locked: boolean; onLock: () => void; expanded: boolean; onExpand: () => void;
  onRotate: (action: "rotate-left" | "rotate-right") => void;
}) {
  const dock = useRef<HTMLElement>(null);
  const lightMenu = useRef<HTMLDetailsElement>(null);
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
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", dismiss);
    };
  }, []);
  return <>
    <div className="room-zoom-controls" role="group" aria-label="Өрөөг ойртуулах, холдуулах">
      <button type="button" aria-label="Ойртуулах" title="Ойртуулах" disabled={locked} onClick={() => onZoom("zoom-in")}><Plus size={22}/></button>
      <button type="button" aria-label="Өрөөг бүтнээр харах" title="Өрөөг бүтнээр харах" disabled={locked} onClick={() => onZoom("fit")}><Focus size={19}/></button>
      <button type="button" aria-label="Холдуулах" title="Холдуулах" disabled={locked} onClick={() => onZoom("zoom-out")}><Minus size={22}/></button>
    </div>
    <div className="room-scene-light-anchor">
        <details className="room-scene-lighting" ref={lightMenu} onToggle={event => { if (!event.currentTarget.open) endLightingEdit?.(); }}>
          <summary aria-label="Гэрлийн тохиргоо" title="Гэрэлтүүлэг"><Lightbulb size={21}/></summary>
          <div className="room-lighting-popup" role="dialog" aria-label="Гэрлийн тохиргоо">
            <div className="room-lighting-popup-header"><strong><Lightbulb size={18}/> Гэрэлтүүлэг</strong><button type="button" aria-label="Гэрлийн тохиргоог хаах" onClick={closeLights}><X size={16}/></button></div>
            <RoomLightingTimeControls windowBearing={windowBearing} ceiling={ceiling} lighting={lighting ?? DEFAULT_ROOM_LIGHTING} onChange={patch=>onLightingChange?.(patch)} beginEdit={()=>beginLightingEdit?.()} endEdit={()=>endLightingEdit?.()} showIntensity />
            <button type="button" className="room-lighting-more" onClick={()=>{closeLights();onLightingSettings?.();}}>Гэрлийн дэлгэрэнгүй тохиргоо</button>
          </div>
        </details>
    </div>
    <nav className="room-view-dock" ref={dock} aria-label="Өрөө харах, засах">
      <div className="room-view-options" role="group" aria-label="Харах өнцөг">
        <button type="button" aria-pressed={view === "dollhouse"} onClick={() => onView("dollhouse")}><Box size={20}/><span>Өрөөний харагдац</span></button>
        <button type="button" aria-pressed={view === "top"} onClick={() => onView("top")}><Grid2X2 size={20}/><span>Дээрээс</span></button>
        <button type="button" aria-pressed={view === "front"} onClick={() => onView("front")}><Eye size={20}/><span>Урдаас</span></button>
      </div>
      <div className="room-dock-edit">
        <button type="button" onClick={onMaterials}><Paintbrush size={20}/><span>Өнгө</span></button>
        <button type="button" aria-pressed={dimensions} onClick={onDimensions}><Ruler size={20}/><span>Хэмжээс</span></button>
        <button type="button" onClick={onWindows}><PanelsTopLeft size={20}/><span>Цонх</span></button>
        <button type="button" className="room-edit-button" onClick={onRoom}><PencilRuler size={20}/><span>Өрөө засах</span></button>
        <details className="room-dock-more">
          <summary aria-label="Нэмэлт удирдлага"><MoreHorizontal size={22}/><ChevronDown size={12}/></summary>
          <div className="room-dock-popover">
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
