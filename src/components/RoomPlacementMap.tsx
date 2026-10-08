"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, DoorOpen, Map, Plus, X } from "lucide-react";
import type { RoomConnection, RoomDesign, RoomPosition, RoomType } from "@/lib/types";
import { getRoomGeometry, ROOM_TYPES, roomPath } from "@/lib/roomGeometry";
import { connectionContact, layoutBounds, roomPosition, snapRoomPosition } from "@/lib/roomLayout";
import "./room-layout.css";

interface Props {
  design: RoomDesign; open: boolean; onOpen: (open: boolean) => void;
  onSelect: (id: string) => void; onAdd: (type: RoomType) => void;
  onMove: (id: string, position: RoomPosition, snap?: boolean) => string | null;
  onConnection: (id: string, patch: Partial<RoomConnection>) => string | null;
  onNotice: (message: string) => void;
  beginEdit: () => void; endEdit: () => void;
}
export function RoomPlacementMap({design,open,onOpen,onSelect,onAdd,onMove,onConnection,onNotice,beginEdit,endEdit}:Props) {
  const rooms=design.rooms??[], bounds=layoutBounds(rooms), padding=2;
  const width=bounds.maxX-bounds.minX+padding*2, depth=bounds.maxZ-bounds.minZ+padding*2;
  const scale=Math.min(360/width,180/depth), cx=(bounds.minX+bounds.maxX)/2,cz=(bounds.minZ+bounds.maxZ)/2;
  const svg=useRef<SVGSVGElement>(null);
  const drag=useRef<{id:string;start:RoomPosition;offset:RoomPosition;pointer:number;moved:boolean}|null>(null);
  const [preview,setPreview]=useState<{id:string;position:RoomPosition;valid:boolean;snapped:boolean}|null>(null);
  useEffect(() => {
    const cancel = () => { drag.current = null; setPreview(null); };
    window.addEventListener("blur", cancel);
    return () => window.removeEventListener("blur", cancel);
  }, []);
  useEffect(() => { drag.current = null; setPreview(null); }, [open, design.id]);
  const [type,setType]=useState<RoomType>("bedroom");
  const [connectionId,setConnectionId]=useState<string|null>(null);
  const connection=design.connections?.find(c=>c.id===connectionId);
  const active=rooms.find(r=>r.id===design.activeRoomId);
  const connections=(design.connections??[]).filter(c=>c.roomA===active?.id||c.roomB===active?.id);
  const point=(clientX:number,clientY:number) => {
    const matrix=svg.current?.getScreenCTM();
    if (!matrix) return null;
    const p=new DOMPoint(clientX,clientY).matrixTransform(matrix.inverse());
    return {x:(p.x-200)/scale+cx,z:(p.y-105)/scale+cz};
  };
  const change=(patch:Partial<RoomConnection>)=>{if (!connection) return; const issue=onConnection(connection.id,patch);if(issue)onNotice(issue);};
  if (!open) return <button type="button" className="room-map-toggle" onClick={()=>onOpen(true)}><Map size={16}/> Өрөөний зураглал</button>;
  return <aside className="room-layout-panel" aria-label="Өрөөнүүдийн зураглал">
    <div className="room-layout-heading"><strong><Map size={16}/> Өрөөнүүдийн зураглал</strong><button type="button" aria-label="Зураглалыг хураах" onClick={()=>onOpen(false)}><X size={16}/></button></div>
    <p className="room-layout-help">Өрөөг чирж зөөнө. Ойртуулбал хананд наалдана.</p>
    <svg ref={svg} viewBox="0 0 400 210" className="room-layout-map" role="group" aria-label="Өрөө зөөх газрын зураг"
      onPointerMove={event=>{
        const current=drag.current,p=point(event.clientX,event.clientY), room=rooms.find(r=>r.id===current?.id);
        if (!current||event.pointerId!==current.pointer||!p||!room) return;
        current.moved ||= Math.hypot(p.x-current.start.x,p.z-current.start.z)>.025;
        const result=snapRoomPosition(room,rooms,{x:p.x-current.offset.x,z:p.z-current.offset.z},Math.min(.3,12/scale));
        setPreview({id:room.id,...result});
      }}
      onPointerUp={event=>{
        const current=drag.current;
        if (!current || event.pointerId!==current.pointer) return;
        const p=point(event.clientX,event.clientY), room=rooms.find(r=>r.id===current.id);
        drag.current=null;
        if (p && room && (current.moved || Math.hypot(p.x-current.start.x,p.z-current.start.z)>.025)) {
          const result=snapRoomPosition(room,rooms,{x:p.x-current.offset.x,z:p.z-current.offset.z},Math.min(.3,12/scale));
          const issue=onMove(current.id,result.position); if(issue)onNotice(issue);
        }
        setPreview(null);
        if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={event=>{if(event.pointerId===drag.current?.pointer){drag.current=null;setPreview(null);}}}
      onLostPointerCapture={()=>{drag.current=null;setPreview(null);}}
      onKeyDown={event=>{if(event.key==="Escape"){drag.current=null;setPreview(null);}}}>
      <defs><pattern id="room-map-grid" width={scale} height={scale} patternUnits="userSpaceOnUse"><path d={`M ${scale} 0 L 0 0 0 ${scale}`} fill="none" stroke="#dfe5eb" strokeWidth=".7"/></pattern></defs>
      <rect width="400" height="210" fill="url(#room-map-grid)"/>
      {rooms.map(room=>{
        const moving=preview?.id===room.id?preview:null,p=moving?.position??roomPosition(room),g=getRoomGeometry(room);
        return <g key={room.id} transform={`translate(${200+(p.x-cx)*scale} ${105+(p.z-cz)*scale})`} role="button" tabIndex={0}
          aria-label={`${room.name}, сумтай товчоор 10 см зөөх`} aria-pressed={design.activeRoomId===room.id}
          onPointerDown={event=>{
            if(event.button!==0 || drag.current)return;event.stopPropagation();const hit=point(event.clientX,event.clientY);if(!hit)return;
            onSelect(room.id);setConnectionId(null);drag.current={id:room.id,start:hit,offset:{x:hit.x-p.x,z:hit.z-p.z},pointer:event.pointerId,moved:false};svg.current?.setPointerCapture(event.pointerId);
          }}
          onKeyDown={event=>{
            if(event.key==="Enter"||event.key===" "){event.preventDefault();onSelect(room.id);return;}
            const delta=event.shiftKey?.5:.1;
            const direction=({ArrowLeft:{x:-delta,z:0},ArrowRight:{x:delta,z:0},ArrowUp:{x:0,z:-delta},ArrowDown:{x:0,z:delta}} as Record<string,RoomPosition>)[event.key];
            if(!direction)return;event.preventDefault();onSelect(room.id);const issue=onMove(room.id,{x:p.x+direction.x,z:p.z+direction.z},false);if(issue)onNotice(issue);
          }}>
          <path d={roomPath(room,scale)} fill={moving&&!moving.valid?"#fee2e2":design.activeRoomId===room.id?"#dceeff":"#f7f4ed"} fillRule="evenodd" stroke={moving&&!moving.valid?"#dc4545":design.activeRoomId===room.id?"#0876c2":"#8f969e"} strokeWidth={design.activeRoomId===room.id?2.5:1.5}/>
          <text x="0" y="-4" textAnchor="middle" fontSize="11" fill="#263848" pointerEvents="none">{room.name}</text>
          <text x="0" y="12" textAnchor="middle" fontSize="9" fill="#637182" pointerEvents="none">{g.area.toFixed(1)} м²</text>
        </g>;
      })}
      {(design.connections??[]).map(c=>{
        const contact=connectionContact(rooms,c);if(!contact)return null;
        return <line key={c.id} x1={200+(contact.a.x-cx)*scale} y1={105+(contact.a.z-cz)*scale} x2={200+(contact.b.x-cx)*scale} y2={105+(contact.b.z-cz)*scale} stroke={c.kind==="open"?"#21a077":"#0876c2"} strokeWidth="5" strokeDasharray={c.kind==="open"?"5 3":undefined} role="button" tabIndex={0} aria-label="Өрөөнүүдийн холбоос тохируулах" onClick={()=>{onSelect(c.roomA);setConnectionId(c.id);}} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();onSelect(c.roomA);setConnectionId(c.id);}}}/>;
      })}
    </svg>
    <div className="room-layout-status" role="status">{preview?preview.valid?preview.snapped?"Хананд наалдлаа · тавьж холбоно":"Байрлуулж болно":"Өрөөнүүд давхцаж байна":`${rooms.length} өрөө · ${design.connections?.length??0} холбоос`}</div>
    <div className="room-layout-add"><select aria-label="Нэмэх өрөөний төрөл" value={type} onChange={e=>setType(e.target.value as RoomType)}>{Object.entries(ROOM_TYPES).map(([id,r])=><option key={id} value={id}>{r.label}</option>)}</select><button type="button" onClick={()=>onAdd(type)}><Plus size={15}/> Өрөө нэмэх</button></div>
    {!!connections.length && <label className="room-layout-field"><span><DoorOpen size={14}/> {active?.name} · холбоос</span><select value={connection?.id??""} onChange={event=>setConnectionId(event.target.value||null)}><option value="">Холбоосоо сонгох</option>{connections.map(c=><option key={c.id} value={c.id}>{rooms.find(r=>r.id===(c.roomA===active?.id?c.roomB:c.roomA))?.name} · {c.kind==="open"?"Хаалгагүй":"Хаалгатай"}</option>)}</select></label>}
    {connection && <div className="room-layout-connection">
      <div className="room-layout-options"><button type="button" aria-pressed={connection.kind==="door"} onClick={()=>change({kind:"door"})}>Хаалгатай</button><button type="button" aria-pressed={connection.kind==="open"} onClick={()=>change({kind:"open"})}>Хаалгагүй</button></div>
      {connection.kind==="open"?<p>Нийлсэн хэсгийн хана бүтнээрээ нээгдэнэ.</p>:<>
        <div className="room-layout-door-size">{(["doorWidth","doorHeight"] as const).map(key=><label key={key}><span>{key==="doorWidth"?"Өргөн":"Өндөр"} · см</span><input type="number" min="30" step="5" aria-label={key==="doorWidth"?"Холбох хаалганы өргөн":"Холбох хаалганы өндөр"} value={Math.round(connection[key]*100)} onFocus={beginEdit} onBlur={endEdit} onChange={event=>{if(event.target.value)change({[key]:Number(event.target.value)/100});}}/></label>)}</div>
        <label className="room-layout-field"><span>Хаалганы байрлал</span><input type="range" min="0" max="1" step=".01" value={connection.position} onPointerDown={beginEdit} onPointerUp={endEdit} onPointerCancel={endEdit} onFocus={beginEdit} onBlur={endEdit} onChange={event=>change({position:Number(event.target.value)})}/></label>
        <div className="room-layout-door-size"><label><span>Нугас</span><select value={connection.hinge} onChange={e=>change({hinge:e.target.value as "left"|"right"})}><option value="left">Зүүн</option><option value="right">Баруун</option></select></label><label><span>Нээгдэх чиглэл</span><select value={connection.swing} onChange={e=>change({swing:e.target.value as "inward"|"outward"})}><option value="inward">Дотогш</option><option value="outward">Гадагш</option></select></label></div>
      </>}
      <button type="button" className="room-layout-collapse" onClick={()=>setConnectionId(null)}><ChevronDown size={14}/> Хураах</button>
    </div>}
  </aside>;
}
