import { Color } from "three";
import type { RoomDesign, RoomWall } from "@/lib/types";
import { solarLighting } from "@/lib/roomLighting";
import { openingWorldTransform } from "@/lib/roomOpenings";
import { getRoomMaterial } from "@/lib/roomMaterials";

const WALLS: RoomWall[] = ["north", "east", "south", "west"];

/** Only surface/light changes rebuild the paint's low-resolution room environment. */
export function paintReflectionKey(room: RoomDesign): string {
  return JSON.stringify({ width:room.width,depth:room.depth,height:room.height,
    outline:room.outline,wallColor:room.wallColor,floorColor:room.floorColor,
    floorMaterial:room.floorMaterial,ceilingMaterial:room.ceilingMaterial,wallMaterials:room.wallMaterials,
    openings:room.openings,lighting:room.lighting });
}

export function paintReflectionRoom(key: string) { return JSON.parse(key) as RoomDesign; }

/** Broad radiance from the room shell, not a live mirror of furniture. */
export function paintRoomRadiance(room: RoomDesign) {
  const solar=solarLighting(room.lighting), halfHeight=(room.height ?? 2.7)/2;
  const colors=Object.fromEntries(WALLS.map(wall=>[wall,new Color(room.wallMaterials?.[wall]?.color ?? room.wallColor ?? "#efe6d6")])) as Record<RoomWall,Color>;
  const floor=new Color(getRoomMaterial(room.floorMaterial)?.color ?? room.floorColor ?? "#bc9468");
  const ceiling=new Color(getRoomMaterial(room.ceilingMaterial)?.color ?? "#f3f1eb");
  const windows=(room.openings ?? []).filter(o=>o.kind==='window').map(opening=>({opening,...openingWorldTransform(room,opening)}));
  const windowColor=new Color("#e4efff").multiplyScalar(1.8*solar.daylight);
  const fill=.12+.8*solar.daylight+(solar.lampsOn?.2:0);
  return (x:number,y:number,z:number): Color => {
    const tx=Math.abs(x)>1e-9?room.width/2/Math.abs(x):Infinity;
    const tz=Math.abs(z)>1e-9?room.depth/2/Math.abs(z):Infinity;
    const ty=Math.abs(y)>1e-9?halfHeight/Math.abs(y):Infinity;
    const distance=Math.min(tx,tz,ty);
    if (distance===ty) return (y>0?ceiling:floor).clone().multiplyScalar(fill);
    const wall:RoomWall=distance===tx?(x>0?'east':'west'):(z>0?'south':'north');
    const hitX=x*distance,hitY=halfHeight+y*distance,hitZ=z*distance;
    if (windows.some(w=>w.opening.wallId===wall && Math.abs((hitX-w.x)*Math.cos(w.rotation)-(hitZ-w.z)*Math.sin(w.rotation))<w.opening.width/2
      && hitY>w.opening.sillHeight && hitY<w.opening.sillHeight+w.opening.height)) return windowColor.clone();
    return colors[wall].clone().multiplyScalar(fill);
  };
}

export function paintReflectionPixels(room: RoomDesign, width=256, height=128) {
  const data=new Float32Array(width*height*4), sample=paintRoomRadiance(room);
  for(let row=0;row<height;row++) for(let column=0;column<width;column++) {
    const longitude=((column+.5)/width-.5)*Math.PI*2;
    const latitude=((row+.5)/height-.5)*Math.PI;
    const cos=Math.cos(latitude),color=sample(Math.cos(longitude)*cos,Math.sin(latitude),Math.sin(longitude)*cos);
    const offset=(row*width+column)*4;
    data[offset]=color.r;data[offset+1]=color.g;data[offset+2]=color.b;data[offset+3]=1;
  }
  return {data,width,height};
}
