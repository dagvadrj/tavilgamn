import type { RoomCeiling, RoomShape, CeilingFixtureKind, CeilingFixture } from "./types";
import { getRoomGeometry, type Bounds, type RoomSegment } from "./roomGeometry";

export const CEILING_FIXTURE_TYPES: Array<{id:CeilingFixtureKind;name:string}>=[{id:"flush",name:"Плафон"},{id:"recessed",name:"Суулгадаг спот"},{id:"pendant",name:"Унждаг гэрэл"},{id:"linear",name:"Шугаман гэрэл"}];
export const DEFAULT_ROOM_CEILING: RoomCeiling={kind:"flat",drop:.15,borderWidth:.3,coveEnabled:false,coveColor:"#ffe3b3",coveIntensity:20};
const clamp=(value:number|undefined,fallback:number,min:number,max:number)=>Math.max(min,Math.min(max,Number.isFinite(value)?value!:fallback));
export function normalizeRoomCeiling(value?:RoomCeiling,room?:Pick<RoomShape,"width"|"depth">):RoomCeiling{
  return {kind:value?.kind==="tray"?"tray":"flat",drop:clamp(value?.drop,.15,.08,.4),borderWidth:clamp(value?.borderWidth,.3,.15,Math.min(.8,room?Math.min(room.width,room.depth)/2-.1:.8)),coveEnabled:value?.coveEnabled===true,coveColor:/^#[0-9a-f]{6}$/i.test(value?.coveColor??"")?value!.coveColor:"#ffe3b3",coveIntensity:clamp(value?.coveIntensity,20,0,40)};
}
const inside=(x:number,z:number,b:Bounds)=>x>b.minX&&x<b.maxX&&z>b.minZ&&z<b.maxZ;
const cache=new Map<string,{config:RoomCeiling;slabs:Bounds[];innerEdges:RoomSegment[];xs:number[];zs:number[]}>();
/** Exact orthogonal ceiling cells respect notches, recesses and columns. */
export function ceilingPlan(room:RoomShape&{ceiling?:RoomCeiling}){
  const config=normalizeRoomCeiling(room.ceiling,room),g=getRoomGeometry(room),key=JSON.stringify([room.width,room.depth,room.wallFeatures,room.columns,config]);
  const saved=cache.get(key);if(saved)return saved;
  const w=config.borderWidth,coords=(axis:"x"|"z")=>[...new Set(g.segments.flatMap(s=>[s.a[axis],s.b[axis],s.a[axis]-w,s.a[axis]+w,s.b[axis]-w,s.b[axis]+w]).filter(v=>v>=(axis==="x"?g.bounds.minX:g.bounds.minZ)&&v<=(axis==="x"?g.bounds.maxX:g.bounds.maxZ)))].sort((a,b)=>a-b);
  const xs=coords("x"),zs=coords("z"),slabs:Bounds[]=[],innerEdges:RoomSegment[]=[],filled=new Map<string,boolean>();
  const occupied=(x:number,z:number)=>inside(x,z,g.bounds)&&!g.voids.some(b=>inside(x,z,b));
  const border=(x:number,z:number)=>g.segments.some(s=>Math.abs(s.nx?x-s.a.x:z-s.a.z)<w-.000001&&(s.nx?z>=Math.min(s.a.z,s.b.z)&&z<=Math.max(s.a.z,s.b.z):x>=Math.min(s.a.x,s.b.x)&&x<=Math.max(s.a.x,s.b.x)));
  if(config.kind==="tray")for(let i=1;i<xs.length;i++)for(let j=1;j<zs.length;j++){
    const x=(xs[i-1]+xs[i])/2,z=(zs[j-1]+zs[j])/2;if(!occupied(x,z))continue;
    const isBorder=border(x,z);filled.set(i+":"+j,isBorder);
    if(isBorder)slabs.push({minX:xs[i-1],maxX:xs[i],minZ:zs[j-1],maxZ:zs[j]});
  }
  for(let i=1;i<xs.length;i++)for(let j=1;j<zs.length;j++)if(filled.get(i+":"+j)){
    if(filled.get((i-1)+":"+j)===false)innerEdges.push({a:{x:xs[i-1],z:zs[j-1]},b:{x:xs[i-1],z:zs[j]},nx:-1,nz:0,length:zs[j]-zs[j-1],hole:false});
    if(filled.get((i+1)+":"+j)===false)innerEdges.push({a:{x:xs[i],z:zs[j-1]},b:{x:xs[i],z:zs[j]},nx:1,nz:0,length:zs[j]-zs[j-1],hole:false});
    if(filled.get(i+":"+(j-1))===false)innerEdges.push({a:{x:xs[i-1],z:zs[j-1]},b:{x:xs[i],z:zs[j-1]},nx:0,nz:-1,length:xs[i]-xs[i-1],hole:false});
    if(filled.get(i+":"+(j+1))===false)innerEdges.push({a:{x:xs[i-1],z:zs[j]},b:{x:xs[i],z:zs[j]},nx:0,nz:1,length:xs[i]-xs[i-1],hole:false});
  }
  const result={config,slabs,innerEdges,xs,zs};cache.set(key,result);while(cache.size>32)cache.delete(cache.keys().next().value!);return result;
}
export function ceilingHeightAt(room:RoomShape&{ceiling?:RoomCeiling},x:number,z:number){const p=ceilingPlan(room);return (room.height??2.7)-(p.slabs.some(s=>x>=s.minX-.000001&&x<=s.maxX+.000001&&z>=s.minZ-.000001&&z<=s.maxZ+.000001)?p.config.drop:0);}

export function ceilingFixtureBounds(fixture:CeilingFixture):Bounds{
  const kind=fixture.kind??"flush",halfX=kind==="linear"?.5:kind==="pendant"?.22:kind==="recessed"?.08:.19,halfZ=kind==="linear"?.06:halfX;
  return {minX:fixture.x-halfX,maxX:fixture.x+halfX,minZ:fixture.z-halfZ,maxZ:fixture.z+halfZ};
}
export function fixtureFitsCeiling(room:RoomShape,fixture:CeilingFixture){
  if(![fixture.x,fixture.z,fixture.intensity].every(Number.isFinite))return false;
  const g=getRoomGeometry(room),b=ceilingFixtureBounds(fixture);
  return b.minX>=g.bounds.minX-.000001&&b.maxX<=g.bounds.maxX+.000001&&b.minZ>=g.bounds.minZ-.000001&&b.maxZ<=g.bounds.maxZ+.000001&&!g.voids.some(v=>b.maxX>v.minX+.000001&&b.minX<v.maxX-.000001&&b.maxZ>v.minZ+.000001&&b.minZ<v.maxZ-.000001);
}
export function fixtureMountHeight(room:RoomShape&{ceiling?:RoomCeiling},fixture:CeilingFixture){const p=ceilingPlan(room),b=ceilingFixtureBounds(fixture);return (room.height??2.7)-(p.slabs.some(s=>b.maxX>s.minX+.000001&&b.minX<s.maxX-.000001&&b.maxZ>s.minZ+.000001&&b.minZ<s.maxZ-.000001)?p.config.drop:0);}
export function fixtureBottomHeight(room:RoomShape&{ceiling?:RoomCeiling},fixture:CeilingFixture){return fixtureMountHeight(room,fixture)-.035-(fixture.kind==="pendant"?Math.max(.2,Math.min(1.2,fixture.pendantDrop??.6))+.08:fixture.kind==="recessed"?.009:fixture.kind==="linear"?.032:.028);}

export function ceilingFixturesOverlap(a: CeilingFixture, b: CeilingFixture): boolean {
  const x = ceilingFixtureBounds(a), y = ceilingFixtureBounds(b);
  return x.maxX > y.minX + .000001 && x.minX < y.maxX - .000001 && x.maxZ > y.minZ + .000001 && x.minZ < y.maxZ - .000001;
}
