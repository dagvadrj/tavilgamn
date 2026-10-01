"use client";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Focus, Minus, Plus, RotateCcw, RotateCw, Scan, View } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import type { CameraAction } from "@/lib/plannerCamera";
import "./viewport-controls.css";

export function ViewportControls({ onAction, disabled = false, plan = false, extra }: {
  onAction: (action: CameraAction) => void; disabled?: boolean; plan?: boolean; extra?: ReactNode;
}) {
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (menu.current?.open && !menu.current.contains(event.target as Node)) menu.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menu.current?.open) {
        menu.current.open = false;
        menu.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  const control = (action: CameraAction, label: string, icon: ReactNode, inactive = false) => (
    <button type="button" key={action} aria-label={label} title={label}
      disabled={disabled || inactive} onClick={() => onAction(action)}>{icon}</button>
  );
  return <aside className="viewport-controls" aria-label="Map удирдлага">
    <div className="viewport-zoom" role="group" aria-label="Ойртуулах ба бүхэлд нь харах">
      {control("zoom-in", "Ойртуулах", <Plus size={19}/>)}
      {control("fit", "Бүхэлд нь харах", <Focus size={19}/>)}
      {control("zoom-out", "Холдуулах", <Minus size={19}/>)}
    </div>
    <details ref={menu} className="viewport-more">
      <summary aria-label="Камерын нэмэлт удирдлага" title="Харах өнцөг, шилжүүлэх"><Scan size={18}/><span>Камер</span></summary>
      <div className="viewport-popover">
        <p>Харах өнцөг</p>
        <div className="viewport-presets">
          {control("top", "Дээрээс харах", <><View size={17}/><span>Дээрээс</span></>)}
          {control("front", "Урд талаас харах", <><View size={17}/><span>Урдаас</span></>)}
        </div>
        <div className="viewport-rotate" role="group" aria-label="45° эргүүлэх">
          {control("rotate-left", "Камерыг зүүн тийш 45° эргүүлэх", <RotateCcw size={18}/>, plan)}
          <span>45°</span>
          {control("rotate-right", "Камерыг баруун тийш 45° эргүүлэх", <RotateCw size={18}/>, plan)}
        </div>
        <p>Харагдацыг шилжүүлэх</p>
        <div className="viewport-pan" role="group" aria-label="Харагдацыг дөрвөн чиглэлд шилжүүлэх">
          {control("pan-up", "Харагдацыг дээш шилжүүлэх", <ArrowUp size={17}/>)}
          {control("pan-left", "Харагдацыг зүүн шилжүүлэх", <ArrowLeft size={17}/>)}
          {control("pan-right", "Харагдацыг баруун шилжүүлэх", <ArrowRight size={17}/>)}
          {control("pan-down", "Харагдацыг доош шилжүүлэх", <ArrowDown size={17}/>)}
        </div>
      </div>
    </details>
    {extra && <div className="viewport-extra">{extra}</div>}
  </aside>;
}
