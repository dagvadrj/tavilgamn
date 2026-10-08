import type { DesignRoom, RoomConnection, RoomOpening, RoomPosition, RoomWall } from "./types";
import { getRoomGeometry, type Bounds, type RoomSegment } from "./roomGeometry";
import { openingWorldTransform } from "./roomOpenings";

const EPS = 0.002;
export const roomPosition = (room: DesignRoom): RoomPosition => room.position ?? { x: 0, z: 0 };
export function roomWorldBounds(room: DesignRoom): Bounds {
  const b = getRoomGeometry(room).bounds, p = roomPosition(room);
  return { minX: b.minX + p.x, maxX: b.maxX + p.x, minZ: b.minZ + p.z, maxZ: b.maxZ + p.z };
}
export function layoutBounds(rooms: DesignRoom[]): Bounds {
  if (!rooms.length) return { minX: -2, maxX: 2, minZ: -2, maxZ: 2 };
  const bounds = rooms.map(roomWorldBounds);
  return { minX: Math.min(...bounds.map(b => b.minX)), maxX: Math.max(...bounds.map(b => b.maxX)), minZ: Math.min(...bounds.map(b => b.minZ)), maxZ: Math.max(...bounds.map(b => b.maxZ)) };
}
/** Old multi-room saves receive separate positions without moving their local furniture. */
export function positionedRooms(rooms: DesignRoom[]): DesignRoom[] {
  const placed: DesignRoom[] = [];
  for (const room of rooms) {
    const valid = room.position && Number.isFinite(room.position.x) && Number.isFinite(room.position.z);
    const bounds = getRoomGeometry(room).bounds;
    const position = valid ? { ...room.position! } : { x: placed.length ? layoutBounds(placed).maxX - bounds.minX + 0.5 : 0, z: 0 };
    placed.push({ ...room, position });
  }
  return placed;
}
function occupied(room: DesignRoom, x: number, z: number) {
  const p = roomPosition(room), g = getRoomGeometry(room), b = g.bounds;
  x -= p.x; z -= p.z;
  return x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ && !g.voids.some(v => x > v.minX && x < v.maxX && z > v.minZ && z < v.maxZ);
}
/** Check actual occupied floor cells, including recesses and notches. */
export function roomsOverlap(a: DesignRoom, b: DesignRoom): boolean {
  const ab = roomWorldBounds(a), bb = roomWorldBounds(b);
  const minX = Math.max(ab.minX, bb.minX), maxX = Math.min(ab.maxX, bb.maxX), minZ = Math.max(ab.minZ, bb.minZ), maxZ = Math.min(ab.maxZ, bb.maxZ);
  if (maxX - minX <= EPS || maxZ - minZ <= EPS) return false;
  const xs = [minX, maxX], zs = [minZ, maxZ];
  for (const room of [a, b]) {
    const p = roomPosition(room);
    for (const v of getRoomGeometry(room).voids) { xs.push(v.minX + p.x, v.maxX + p.x); zs.push(v.minZ + p.z, v.maxZ + p.z); }
  }
  const xList = [...new Set(xs.filter(x => x >= minX && x <= maxX))].sort((x,y) => x-y);
  const zList = [...new Set(zs.filter(z => z >= minZ && z <= maxZ))].sort((x,y) => x-y);
  for (let i=1;i<xList.length;i++) for (let j=1;j<zList.length;j++) {
    const x=(xList[i]+xList[i-1])/2, z=(zList[j]+zList[j-1])/2;
    if (occupied(a,x,z) && occupied(b,x,z)) return true;
  }
  return false;
}
const wallId = (s: RoomSegment): RoomWall => Math.abs(s.nx) > .5 ? s.nx > 0 ? "west" : "east" : s.nz > 0 ? "north" : "south";
function baseSegments(room: DesignRoom) {
  const p = roomPosition(room);
  return getRoomGeometry(room).segments.filter(s => {
    if (s.hole) return false;
    const id = wallId(s), x=(s.a.x+s.b.x)/2, z=(s.a.z+s.b.z)/2;
    return id === "north" ? Math.abs(z+room.depth/2)<EPS : id === "south" ? Math.abs(z-room.depth/2)<EPS : id === "east" ? Math.abs(x-room.width/2)<EPS : Math.abs(x+room.width/2)<EPS;
  }).map(s => ({ ...s, id: wallId(s), a: {x:s.a.x+p.x,z:s.a.z+p.z}, b: {x:s.b.x+p.x,z:s.b.z+p.z} }));
}
export interface RoomContact {
  roomA: string; roomB: string; wallA: RoomWall; wallB: RoomWall;
  a: RoomPosition; b: RoomPosition; length: number;
}
export function roomContacts(a: DesignRoom, b: DesignRoom): RoomContact[] {
  if (roomsOverlap(a,b)) return [];
  const contacts: RoomContact[]=[];
  for (const sa of baseSegments(a)) for (const sb of baseSegments(b)) {
    if (sa.nx*sb.nx+sa.nz*sb.nz > -.99) continue;
    const horizontal = Math.abs(sa.a.z-sa.b.z)<EPS;
    if (Math.abs(horizontal ? sa.a.z-sb.a.z : sa.a.x-sb.a.x)>EPS) continue;
    const lo=Math.max(Math.min(horizontal?sa.a.x:sa.a.z,horizontal?sa.b.x:sa.b.z),Math.min(horizontal?sb.a.x:sb.a.z,horizontal?sb.b.x:sb.b.z));
    const hi=Math.min(Math.max(horizontal?sa.a.x:sa.a.z,horizontal?sa.b.x:sa.b.z),Math.max(horizontal?sb.a.x:sb.a.z,horizontal?sb.b.x:sb.b.z));
    if (hi-lo<.3) continue;
    contacts.push({roomA:a.id,roomB:b.id,wallA:sa.id,wallB:sb.id,a:horizontal?{x:lo,z:sa.a.z}:{x:sa.a.x,z:lo},b:horizontal?{x:hi,z:sa.a.z}:{x:sa.a.x,z:hi},length:hi-lo});
  }
  return contacts.sort((a,b)=>b.length-a.length);
}
export function connectionContact(rooms: DesignRoom[], c: RoomConnection) {
  const a=rooms.find(r=>r.id===c.roomA), b=rooms.find(r=>r.id===c.roomB);
  return a && b ? roomContacts(a,b).find(s=>s.wallA===c.wallA && s.wallB===c.wallB) : undefined;
}
export function validConnections(rooms: DesignRoom[], connections: RoomConnection[]) {
  return connections.filter(c => {
    const contact=connectionContact(rooms,c), a=rooms.find(r=>r.id===c.roomA), b=rooms.find(r=>r.id===c.roomB);
    return contact && (c.kind === "open" || (c.doorWidth >= .3 && c.doorWidth + .12 <= contact.length + EPS && c.doorHeight >= .3 && c.doorHeight + .06 <= Math.min(a?.height??2.7,b?.height??2.7)));
  }).map(c=>({...c,position:Math.min(1,Math.max(0,c.position))}));
}
export function defaultConnection(contact: RoomContact, rooms: DesignRoom[]): RoomConnection {
  const height=Math.min(...rooms.filter(r=>r.id===contact.roomA || r.id===contact.roomB).map(r=>r.height??2.7));
  return { id: `connection_${crypto.randomUUID()}`, roomA: contact.roomA, roomB: contact.roomB, wallA:contact.wallA,wallB:contact.wallB,kind:contact.length>=1.02?"door":"open",doorWidth:Math.max(.3,Math.min(.9,contact.length-.12)),doorHeight:Math.min(2.1,height-.06),position:.5,hinge:"left",swing:"inward" };
}
/** Snap only to a real opposing wall; corners alone do not create connections. */
export function snapRoomPosition(room: DesignRoom, rooms: DesignRoom[], requested: RoomPosition, threshold=.3) {
  const others=rooms.filter(r=>r.id!==room.id);
  const candidates=[{...requested}];
  const moving={...room,position:requested};
  for (const other of others) for (const sa of baseSegments(moving)) for (const sb of baseSegments(other)) {
    if (sa.nx*sb.nx+sa.nz*sb.nz>-.99) continue;
    const horizontal=Math.abs(sa.a.z-sa.b.z)<EPS;
    const gap=horizontal?sb.a.z-sa.a.z:sb.a.x-sa.a.x;
    if (Math.abs(gap)>threshold) continue;
    const p=horizontal?{x:requested.x,z:requested.z+gap}:{x:requested.x+gap,z:requested.z};
    candidates.push(p);
    for (const [from,to] of [[sa.a,sb.a],[sa.a,sb.b],[sa.b,sb.a],[sa.b,sb.b]]) {
      const along=horizontal?to.x-from.x:to.z-from.z;
      if (Math.abs(along)<=threshold) candidates.push(horizontal?{x:p.x+along,z:p.z}:{x:p.x,z:p.z+along});
    }
  }
  const valid=candidates.filter(p=>!others.some(other=>roomsOverlap({...room,position:p},other)));
  const snapped=valid.filter(p=>others.some(other=>roomContacts({...room,position:p},other).length));
  const list=snapped.length?snapped:valid;
  list.sort((a,b)=>Math.hypot(a.x-requested.x,a.z-requested.z)-Math.hypot(b.x-requested.x,b.z-requested.z));
  return list[0] ? {position:list[0],valid:true,snapped:snapped.length>0} : {position:requested,valid:false,snapped:false};
}
export interface SharedWallCut { wallId: RoomWall; from: number; to: number; height: number; sillHeight: number }
function wallAlong(room: DesignRoom, wall: RoomWall, point: RoomPosition) {
  const p=roomPosition(room), x=point.x-p.x,z=point.z-p.z;
  return wall==="north"?x+room.width/2:wall==="south"?room.width/2-x:wall==="east"?z+room.depth/2:room.depth/2-z;
}
export function connectionGeometry(room: DesignRoom, rooms: DesignRoom[], connections: RoomConnection[]) {
  const cuts:SharedWallCut[]=[], suppressed:SharedWallCut[]=[], openings:RoomOpening[]=[];
  for (const c of connections) {
    if (c.roomA!==room.id && c.roomB!==room.id) continue;
    const contact=connectionContact(rooms,c); if (!contact) continue;
    const wall=c.roomA===room.id?c.wallA:c.wallB;
    const from=Math.min(wallAlong(room,wall,contact.a),wallAlong(room,wall,contact.b)), to=Math.max(wallAlong(room,wall,contact.a),wallAlong(room,wall,contact.b));
    const other=rooms.find(r=>r.id===(c.roomA===room.id?c.roomB:c.roomA))!;
    // One shared wall belongs to the taller room; the other copy disappears.
    const owner=(room.height??2.7)>(other.height??2.7) || ((room.height??2.7)===(other.height??2.7) && room.id===c.roomA);
    const full={wallId:wall,from,to,height:(room.height??2.7)+.05,sillHeight:0};
    suppressed.push(full);
    if (!owner || c.kind==="open") { cuts.push(full); continue; }
    const usable=Math.max(0,contact.length-c.doorWidth-.12);
    const world={x:contact.a.x+(contact.b.x-contact.a.x)*(.06+c.doorWidth/2+usable*c.position)/contact.length,z:contact.a.z+(contact.b.z-contact.a.z)*(.06+c.doorWidth/2+usable*c.position)/contact.length};
    const along=wallAlong(room,wall,world), length=wall==="north"||wall==="south"?room.width:room.depth;
    cuts.push({wallId:wall,from:along-c.doorWidth/2,to:along+c.doorWidth/2,height:c.doorHeight,sillHeight:0});
    openings.push({id:c.id,kind:"door",templateId:"door-single",wallId:wall,position:along/length,width:c.doorWidth,height:c.doorHeight,sillHeight:0,hinge:c.hinge,swing:c.swing,open:true});
  }
  const visibleOpenings=(room.openings??[]).filter(o=>{
    const transform=openingWorldTransform(room,o),p=roomPosition(room), along=wallAlong(room,o.wallId,{x:transform.x+p.x,z:transform.z+p.z});
    return !suppressed.some(s=>s.wallId===o.wallId && along+o.width/2>s.from && along-o.width/2<s.to);
  });
  return {cuts,openings,visibleOpenings,boundaries:suppressed};
}

/** Convert shared world spans into the exact local cutter coordinates for a wall segment. */
export function sharedCutsForSegment(room: Pick<DesignRoom, "width" | "depth" | "height">, segment: RoomSegment, cuts: SharedWallCut[]) {
  const id=wallId(segment), x=(segment.a.x+segment.b.x)/2,z=(segment.a.z+segment.b.z)/2;
  const base=id==="north"?Math.abs(z+room.depth/2)<EPS:id==="south"?Math.abs(z-room.depth/2)<EPS:id==="east"?Math.abs(x-room.width/2)<EPS:Math.abs(x+room.width/2)<EPS;
  if(!base)return [];
  const rotation=-Math.atan2(segment.b.z-segment.a.z,segment.b.x-segment.a.x);
  const length=id==="north"||id==="south"?room.width:room.depth;
  return cuts.filter(c=>c.wallId===id).flatMap(c=>{
    const centre=openingWorldTransform(room,{wallId:id,position:(c.from+c.to)/2/length} as RoomOpening);
    const along=(centre.x-x)*Math.cos(rotation)-(centre.z-z)*Math.sin(rotation);
    const from=Math.max(-segment.length/2,along-(c.to-c.from)/2),to=Math.min(segment.length/2,along+(c.to-c.from)/2);
    return to-from>.001?[{x:(from+to)/2,width:to-from+(c.height > (room.height ?? 2.7) ? .002 : 0),height:c.height,sillHeight:c.sillHeight}]:[];
  });
}
