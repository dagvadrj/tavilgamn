import type { DesignRoom, RoomShape } from "./types";
import { getRoomGeometry, type RoomSegment } from "./roomGeometry";
import { roomPosition } from "./roomLayout";
import type { MeasurementPoint } from "./furnitureMeasurements";

export interface RoomMeasurement {
  id: string;
  label: string;
  value: number;
  from: MeasurementPoint;
  to: MeasurementPoint;
  wallFrom: MeasurementPoint;
  wallTo: MeasurementPoint;
  tick: MeasurementPoint;
}
const EPS = .000001;
export function formatRoomMeasurement(metres: number): string {
  const millimetres = Math.round(metres * 1000);
  return (millimetres / 1000).toFixed(millimetres % 10 ? 3 : 2) + " м";
}
/** Lines stay in each room's floor coordinates; gaps and exterior wall thickness are excluded. */
export function getRoomMeasurements(room: RoomShape & {id?:string;position?:DesignRoom["position"]}, neighbours: DesignRoom[] = []): RoomMeasurement[] {
  const geometry = getRoomGeometry(room), origin = room.position ?? {x:0,z:0};
  const walls = geometry.segments.filter(s => !s.hole && !(room.columns??[]).some(c => {
    const x=(s.a.x+s.b.x)/2,z=(s.a.z+s.b.z)/2,left=c.x-room.width/2,top=c.z-room.depth/2;
    return x>=left-EPS&&x<=left+c.width+EPS&&z>=top-EPS&&z<=top+c.depth+EPS;
  }));
  const otherBounds = neighbours.filter(other=>other.id!==room.id).map(other=>{
    const bounds=getRoomGeometry(other).bounds,p=roomPosition(other);
    return {minX:bounds.minX+p.x-origin.x,maxX:bounds.maxX+p.x-origin.x,minZ:bounds.minZ+p.z-origin.z,maxZ:bounds.maxZ+p.z-origin.z};
  });
  const obstruction = (wall:RoomSegment,offset=.45) => {
    const horizontal=Math.abs(wall.a.z-wall.b.z)<EPS,constant=horizontal?wall.a.z-wall.nz*offset:wall.a.x-wall.nx*offset;
    const lo=Math.min(horizontal?wall.a.x:wall.a.z,horizontal?wall.b.x:wall.b.z),hi=Math.max(horizontal?wall.a.x:wall.a.z,horizontal?wall.b.x:wall.b.z);
    return otherBounds.reduce((sum,b)=>{
      if(constant<(horizontal?b.minZ:b.minX)-.1||constant>(horizontal?b.maxZ:b.maxX)+.1)return sum;
      return sum+Math.max(0,Math.min(hi,horizontal?b.maxX:b.maxZ)-Math.max(lo,horizontal?b.minX:b.minZ));
    },0);
  };
  // Measure a rectangle on its two free sides; irregular rooms show their real wall spans.
  const rectangle=walls.length===4&&new Set(walls.map(s=>s.nx+":"+s.nz)).size===4;
  const candidates: Array<{wall:RoomSegment;id:string;label:string}> = rectangle
    ? [
      {wall:walls.filter(s=>Math.abs(s.a.z-s.b.z)<EPS).sort((a,b)=>obstruction(a)-obstruction(b)||a.nz-b.nz)[0],id:"width",label:"Өргөн"},
      {wall:walls.filter(s=>Math.abs(s.a.x-s.b.x)<EPS).sort((a,b)=>obstruction(a)-obstruction(b)||a.nx-b.nx)[0],id:"depth",label:"Урт / гүн"},
    ]
    : walls.map((wall,i)=>({wall,id:"wall-"+i,label:"Хана "+(i+1)}));
  return candidates.map(({wall,id,label})=>{
    const offset=obstruction(wall)>EPS?-.25:.45,y=.035;
    return {id,label,value:wall.length,
      from:[wall.a.x-wall.nx*offset,y,wall.a.z-wall.nz*offset],to:[wall.b.x-wall.nx*offset,y,wall.b.z-wall.nz*offset],
      wallFrom:[wall.a.x,y,wall.a.z],wallTo:[wall.b.x,y,wall.b.z],tick:[wall.nx*.09,0,wall.nz*.09]};
  });
}
