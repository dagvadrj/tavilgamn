"use client";
import type { RoomLighting } from "@/lib/types";
import { normalizeSunBearing, sunDirection } from "@/lib/roomSunlight";
export function RoomSunlightControls({lighting,windowBearing=0,onChange,beginEdit,endEdit}:{lighting:RoomLighting;windowBearing?:number;onChange:(patch:Partial<RoomLighting>)=>void;beginEdit:()=>void;endEdit:()=>void}) {
  const manual=Number.isFinite(lighting.sunAzimuth),sun=sunDirection(lighting,windowBearing),bearing=normalizeSunBearing(lighting.sunAzimuth??windowBearing+18);
  const edit={onPointerDown:beginEdit,onPointerUp:endEdit,onPointerCancel:endEdit,onFocus:beginEdit,onBlur:endEdit};
  return <div className="room-sun-controls">
    <div className="room-section-heading"><h4>Нарны тусах чиглэл</h4><span className="room-panel-badge">{Math.round(sun.azimuth)}°</span></div>
    <div className="room-sun-modes" role="group" aria-label="Нарны чиглэлийн горим">
      <button type="button" aria-pressed={!manual} onClick={()=>onChange({sunAzimuth:undefined})}>Цонхоор</button>
      <button type="button" aria-pressed={manual} onClick={()=>onChange({sunAzimuth:bearing})}>Өөрөө тохируулах</button>
    </div>
    <div className="room-sun-compass"><svg viewBox="0 0 90 90" aria-hidden="true"><circle cx="45" cy="45" r="29" fill="#f8fafc" stroke="#e0e5ea"/><text x="45" y="10" textAnchor="middle">N</text><text x="83" y="48" textAnchor="middle">E</text><text x="45" y="88" textAnchor="middle">S</text><text x="6" y="48" textAnchor="middle">W</text><g transform={"rotate("+sun.azimuth+" 45 45)"}><circle cx="45" cy="23" r="5" fill="#e7b35c"/><path d="M45 31V60M41 56L45 60L49 56" fill="none" stroke="#e7b35c" strokeWidth="2"/></g></svg><p>{manual?"13:00 цагийн суурь чиглэл. Цаг өөрчлөхөд нар шилжинэ.":"Гадна ханын хамгийн том цонхоор шалан дээр ташуу гэрэл тусгана."}</p></div>
    {manual&&<label className="room-light-intensity"><span>Нарны чиглэл · 13:00<output>{Math.round(bearing)}°</output></span><input type="range" aria-label="Нарны чиглэл" min="0" max="359" step="1" value={bearing} {...edit} onChange={e=>onChange({sunAzimuth:Number(e.target.value)})}/></label>}
    <label className="room-auto-light"><input type="checkbox" checked={!Number.isFinite(lighting.sunElevation)} onChange={e=>onChange({sunElevation:e.target.checked?undefined:sun.elevation})}/><span>Нарны өндрийг цагаар өөрчлөх<small>Нам нар урт сүүдэр үүсгэнэ</small></span></label>
    {Number.isFinite(lighting.sunElevation)&&<label className="room-light-intensity"><span>Нарны өндөр<output>{Math.round(sun.elevation)}°</output></span><input type="range" aria-label="Нарны өндөр" min="5" max="75" step="1" value={sun.elevation} {...edit} onChange={e=>onChange({sunElevation:Number(e.target.value)})}/></label>}
  </div>;
}
