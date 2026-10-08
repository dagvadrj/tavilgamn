"use client";
import { Lightbulb, Moon, Sun } from "lucide-react";
import type { RoomLighting, RoomCeiling } from "@/lib/types";
import { formatLightingTime, lightingTime, solarLighting } from "@/lib/roomLighting";
import "./room-lighting-controls.css";
import { RoomSunlightControls } from "./RoomSunlightControls";

interface Props {
  lighting: RoomLighting;
  ceiling?: RoomCeiling;
  windowBearing?: number;
  onChange: (patch: Partial<RoomLighting>) => void;
  beginEdit: () => void;
  endEdit: () => void;
  showIntensity?: boolean;
}
export function RoomLightingTimeControls({ lighting, ceiling, windowBearing, onChange, beginEdit, endEdit, showIntensity = false }: Props) {
  const solar = solarLighting(lighting);
  const coveOn = ceiling?.kind === "tray" && ceiling.coveEnabled && ceiling.coveIntensity > 0;
  const time = lightingTime(lighting);
  const changeTime = (timeOfDay: number) => onChange({ timeOfDay, mode: timeOfDay >= 20 || timeOfDay < 6 ? "evening" : "day" });
  const averageIntensity = lighting.fixtures.length ? lighting.fixtures.reduce((sum, fixture) => sum + fixture.intensity, 0) / lighting.fixtures.length : 0;
  const edit = { onPointerDown: beginEdit, onPointerUp: endEdit, onPointerCancel: endEdit, onFocus: beginEdit, onBlur: endEdit };
  return <div className="room-time-control">
    <label className="room-time-heading">
      <span>Өдрийн цаг · бүх өрөө</span>
      <strong>{solar.night ? <Moon size={20}/> : <Sun size={20}/>} {formatLightingTime(time)}</strong>
      <input type="range" aria-label="Өдрийн цаг" min="0" max="23.75" step=".25" value={time} {...edit} onChange={event => changeTime(Number(event.target.value))}/>
    </label>
    <div className="room-time-axis"><span>00:00</span><span>12:00</span><span>23:45</span></div>
    <div className="room-light-time-presets" role="group" aria-label="Гэрэлтүүлгийн цаг сонгох">
      {([{time:8,label:"Өглөө"},{time:12,label:"Өдөр"},{time:18,label:"Үдэш"},{time:21,label:"Шөнө"}]).map(preset => <button type="button" key={preset.time} aria-pressed={time===preset.time} onClick={() => changeTime(preset.time)}>{preset.label}</button>)}
    </div>
    <RoomSunlightControls lighting={lighting} windowBearing={windowBearing} onChange={onChange} beginEdit={beginEdit} endEdit={endEdit}/>
    <label className="room-auto-light"><input type="checkbox" checked={lighting.autoLights !== false} onChange={event => onChange({ autoLights: event.target.checked })}/><span>Таазны гэрэл автоматаар асаах<small>20:00–06:00 · харанхуйд асна</small></span></label>
    <div className="room-time-status" role="status"><Lightbulb size={15}/>{solar.lampsOn ? lighting.fixtures.some(f=>f.intensity>0) || coveOn ? coveOn ? "Таазны далд гэрэл асаалттай" : "Таазны гэрэл асаалттай" : "Таазны гэрлийн хүчийг нэмнэ үү" : "Нарны гэрэл · таазны гэрэл унтраалттай"}</div>
    {showIntensity && <label className="room-light-intensity"><span>Таазны гэрлийн хүч<output>{Math.round(averageIntensity / 40 * 100)}%</output></span><input type="range" aria-label="Таазны гэрлийн хүч" min="0" max="40" step="1" value={averageIntensity} disabled={!lighting.fixtures.length} {...edit} onChange={event => onChange({fixtures:lighting.fixtures.map(fixture=>({...fixture,intensity:Number(event.target.value)}))})}/></label>}
  </div>;
}
