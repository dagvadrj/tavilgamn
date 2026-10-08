"use client";
import { Html, Line } from "@react-three/drei";
import type { DesignRoom, RoomShape } from "@/lib/types";
import { getRoomMeasurements, formatRoomMeasurement } from "@/lib/roomMeasurements";
import type { MeasurementPoint } from "@/lib/furnitureMeasurements";
const noRaycast=()=>{};

export function RoomDimensions({room,neighbours=[],name,active=true}:{room:RoomShape&{id?:string;position?:DesignRoom["position"]};neighbours?:DesignRoom[];name?:string;active?:boolean}) {
  const measurements=getRoomMeasurements(room,neighbours),color=active?"#0876c2":"#64727d";
  const lineProps={color,lineWidth:1,depthTest:false,depthWrite:false,renderOrder:1000,raycast:noRaycast};
  return <group>{measurements.map(m=>{
    const midpoint=m.from.map((v,i)=>(v+m.to[i])/2) as MeasurementPoint;
    return <group key={m.id}>
      <Line points={[m.from,m.to]} {...lineProps}/>
      {[m.from,m.to].map((point,i)=><Line key={i} points={[point.map((v,j)=>v-m.tick[j]) as MeasurementPoint,point.map((v,j)=>v+m.tick[j]) as MeasurementPoint]} {...lineProps}/>)}
      <Line points={[m.wallFrom,m.from]} {...lineProps} transparent opacity={.45}/>
      <Line points={[m.wallTo,m.to]} {...lineProps} transparent opacity={.45}/>
      <Html position={midpoint} center zIndexRange={[9,0]} style={{pointerEvents:"none"}}>
        <span className="planner-measure-label" style={{color,borderColor:active?"#0876c233":undefined}} title={(name??"Өрөө")+" · "+m.label} aria-label={(name??"Өрөө")+" · "+m.label+" · "+formatRoomMeasurement(m.value)}>{formatRoomMeasurement(m.value)}</span>
      </Html>
    </group>;
  })}</group>;
}
