"use client";
import type { RoomCeiling, RoomDesign } from "@/lib/types";
import { RoomMeasureInput } from "./RoomMeasureInput";
import { normalizeRoomCeiling } from "@/lib/roomCeiling";

export function RoomCeilingControls({design,onChange,beginEdit,endEdit,structure=true}:{design:RoomDesign;onChange:(ceiling:RoomCeiling)=>void;beginEdit:()=>void;endEdit:()=>void;structure?:boolean}){
  const ceiling=normalizeRoomCeiling(design.ceiling,design),edit={onPointerDown:beginEdit,onPointerUp:endEdit,onPointerCancel:endEdit,onFocus:beginEdit,onBlur:endEdit};
  const change=(patch:Partial<RoomCeiling>)=>onChange(normalizeRoomCeiling({...ceiling,...patch},design));
  return <div className="room-ceiling-controls">
    {structure&&<>
      <h4>Таазны төрөл</h4>
      <div className="room-ceiling-types" role="group" aria-label="Таазны төрөл">
        {([{kind:"flat",title:"Уналтгүй",hint:"Нэг түвшний тааз"},{kind:"tray",title:"Уналттай",hint:"Хүрээтэй, далд гэрэлтэй"}] as const).map(t=><button type="button" key={t.kind} aria-pressed={ceiling.kind===t.kind} onClick={()=>change({kind:t.kind,...(t.kind==="tray"?{coveEnabled:true}:{})})}>
          <svg viewBox="0 0 100 42" aria-hidden="true"><path d={t.kind==="flat"?"M8 32V12H92V32":"M8 32V12H92V32M8 22H28V12M72 12V22H92"} fill="none" stroke="currentColor" strokeWidth="3"/>{t.kind==="tray"&&<path d="M29 19H37M63 19H71" stroke="#f0b653" strokeWidth="3"/>}</svg><strong>{t.title}</strong><small>{t.hint}</small>
        </button>)}
      </div>
      {ceiling.kind==="tray"&&<div className="room-field-pair">
        <RoomMeasureInput label="Уналтын өндөр" value={ceiling.drop*100} min={8} max={40} onChange={v=>change({drop:v/100})} beginEdit={beginEdit} endEdit={endEdit}/>
        <RoomMeasureInput label="Хүрээний өргөн" value={ceiling.borderWidth*100} min={15} max={Math.floor(Math.min(.8,Math.min(design.width,design.depth)/2-.1)*100)} onChange={v=>change({borderWidth:v/100})} beginEdit={beginEdit} endEdit={endEdit}/>
      </div>}
      {ceiling.kind==="tray"&&<p className="room-control-help">Хүрээний доорх өндөр: {Math.round(((design.height??2.7)-ceiling.drop)*100)} см. Гол хэсэг үндсэн өндөртэй байна.</p>}
    </>}
    <div className="room-ceiling-cove">
      <div className="room-section-heading"><h4>Уналттай таазны далд LED</h4><span className="room-panel-badge">{ceiling.kind==="tray"&&ceiling.coveEnabled?"Нэмсэн":"Унтраалттай"}</span></div>
      {ceiling.kind!=="tray"?<><p className="room-control-help">Далд гэрэл нэмэхэд хүрээтэй уналттай тааз үүснэ.</p><button type="button" className="room-secondary-action" onClick={()=>change({kind:"tray",coveEnabled:true})}>Уналттай тааз + далд гэрэл нэмэх</button></>:<>
        <label className="room-auto-light"><input type="checkbox" checked={ceiling.coveEnabled} onChange={e=>change({coveEnabled:e.target.checked})}/><span>Хүрээний далд гэрэл<small>Өдрийн цаг, автомат асаалтыг дагана</small></span></label>
        {ceiling.coveEnabled&&<>
          <label className="room-color-picker"><span>Далд гэрлийн өнгө</span><input type="color" aria-label="Далд гэрлийн өнгө" value={ceiling.coveColor} {...edit} onChange={e=>change({coveColor:e.target.value})}/></label>
          <div className="room-light-colors" role="group" aria-label="Далд гэрлийн өнгө сонгох">{[{name:"Дулаан",color:"#ffe3b3"},{name:"Цагаан",color:"#fffaf2"},{name:"Хүйтэн",color:"#dcecff"}].map(c=><button type="button" key={c.name} aria-pressed={ceiling.coveColor===c.color} onClick={()=>change({coveColor:c.color})}>{c.name}</button>)}</div>
          <label className="room-light-intensity"><span>Далд гэрлийн хүч<output>{Math.round(ceiling.coveIntensity/40*100)}%</output></span><input type="range" aria-label="Далд гэрлийн хүч" min="0" max="40" step="1" value={ceiling.coveIntensity} {...edit} onChange={e=>change({coveIntensity:Number(e.target.value)})}/></label>
        </>}
      </>}
    </div>
  </div>;
}
