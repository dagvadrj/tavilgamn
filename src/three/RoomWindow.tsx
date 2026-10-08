"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type { RoomOpening } from "@/lib/types";
import { windowLayout } from "@/lib/roomOpenings";
import { ROOM_WALL_THICKNESS } from "@/lib/roomRendering";
import { animateToward } from "./demandAnimation";

function WindowSash({x,width,index,operation,open,children}:{x:number;width:number;index:number;operation:"fixed"|"sliding"|"casement";open:boolean;children:ReactNode}) {
  const ref=useRef<THREE.Group>(null),invalidate=useThree(s=>s.invalidate);
  const side=index===0?-1:1,pivot=operation==="casement"?side*width/2:0;
  const angle=open&&operation==="casement"?side*Math.PI*.38:0;
  const offset=open&&operation==="sliding"&&index===0?width*.82:0;
  useEffect(()=>{invalidate();},[angle,offset,invalidate]);
  useFrame((state,delta)=>{
    if(!ref.current)return;
    const rotate=animateToward(ref.current.rotation.y,angle,10,delta),move=animateToward(ref.current.position.x,x+pivot+offset,10,delta);
    ref.current.rotation.y=rotate.value;ref.current.position.x=move.value;
    if(rotate.moving||move.moving)state.invalidate();
  });
  return <group ref={ref} position={[x+pivot,0,operation==="sliding"?-.015+index*.014:0]}><group position={[-pivot,0,0]}>{children}</group></group>;
}

/** The glass transmits daylight; the frame, mullions and sill cast real shadows. */
export function RoomWindow({opening}:{opening:RoomOpening}) {
  const {width:w,height:h}=opening,{panes,operation}=windowLayout(opening);
  const frame=.06,mullion=.048,sashWidth=(w-2*frame-(panes-1)*mullion)/panes,sashHeight=h-2*frame,sashFrame=.025,seal=.004;
  return <group>
    {[-1,1].map(side=><group key={side}>
      <RoundedBox args={[frame,h,ROOM_WALL_THICKNESS+.05]} radius={.004} smoothness={2} position={[side*(w-frame)/2,h/2,-ROOM_WALL_THICKNESS/2+.018]} castShadow receiveShadow><meshStandardMaterial color="#f5f3ee" roughness={.32} metalness={.03}/></RoundedBox>
      <RoundedBox args={[w,frame,ROOM_WALL_THICKNESS+.05]} radius={.004} smoothness={2} position={[0,side===-1?frame/2:h-frame/2,-ROOM_WALL_THICKNESS/2+.018]} castShadow receiveShadow><meshStandardMaterial color="#f5f3ee" roughness={.32} metalness={.03}/></RoundedBox>
    </group>)}
    {Array.from({length:panes-1},(_,index)=><RoundedBox key={index} args={[mullion,h-2*frame,.145]} radius={.003} smoothness={2} position={[-w/2+frame+(index+1)*sashWidth+(index+.5)*mullion,h/2,-.03]} castShadow receiveShadow><meshStandardMaterial color="#f0efea" roughness={.34}/></RoundedBox>)}
    <group position={[0,h/2,0]}>{Array.from({length:panes},(_,index)=>{
      const x=(index-(panes-1)/2)*(sashWidth+mullion);
      return <WindowSash key={index} x={x} width={sashWidth} index={index} operation={operation} open={opening.open}>
        {[-1,1].map(side=><group key={side}>
          <mesh position={[side*(sashWidth-sashFrame)/2,0,0]} castShadow receiveShadow><boxGeometry args={[sashFrame,sashHeight,.07]}/><meshStandardMaterial color="#eeeee9" roughness={.38}/></mesh>
          <mesh position={[0,side*(sashHeight-sashFrame)/2,0]} castShadow receiveShadow><boxGeometry args={[sashWidth,sashFrame,.07]}/><meshStandardMaterial color="#eeeee9" roughness={.38}/></mesh>
          <mesh position={[side*(sashWidth/2-sashFrame-seal/2),0,.005]}><boxGeometry args={[seal,sashHeight-2*sashFrame,.018]}/><meshStandardMaterial color="#5c625f" roughness={.92}/></mesh>
          <mesh position={[0,side*(sashHeight/2-sashFrame-seal/2),.005]}><boxGeometry args={[sashWidth-2*sashFrame,seal,.018]}/><meshStandardMaterial color="#5c625f" roughness={.92}/></mesh>
        </group>)}
        <mesh><boxGeometry args={[sashWidth-2*sashFrame-2*seal,sashHeight-2*sashFrame-2*seal,.012]}/><meshPhysicalMaterial color="#eff7f9" transmission={.94} transparent opacity={.3} roughness={.035} thickness={.012} ior={1.52} metalness={0} clearcoat={1} clearcoatRoughness={.08} envMapIntensity={1.2} depthWrite={false}/></mesh>
        {operation!=="fixed"&&<group>
          <RoundedBox args={[.018,.085,.035]} radius={.005} smoothness={2} position={[sashWidth/2-.039,-.03,.054]} castShadow><meshStandardMaterial color="#d7d8d4" metalness={.55} roughness={.26}/></RoundedBox>
          <mesh position={[sashWidth/2-.039,-.015,.079]} castShadow><cylinderGeometry args={[.007,.007,.09,12]}/><meshStandardMaterial color="#dfe1dc" metalness={.6} roughness={.24}/></mesh>
        </group>}
      </WindowSash>;
    })}</group>
    <RoundedBox args={[w+.13,.035,ROOM_WALL_THICKNESS+.2]} radius={.007} smoothness={3} position={[0,-.018,.038]} receiveShadow castShadow><meshStandardMaterial color="#f0eee7" roughness={.36}/></RoundedBox>
    <mesh position={[0,-.052,.052]} receiveShadow><boxGeometry args={[w+.06,.034,.025]}/><meshStandardMaterial color="#e7e4dc" roughness={.7}/></mesh>
  </group>;
}
