"use client";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { RoomDesign } from "@/lib/types";
import { ceilingPlan } from "@/lib/roomCeiling";
import { solarLighting } from "@/lib/roomLighting";
import { useRoomMaterial } from "./roomMaterials";

export function TrayCeiling({design,view}:{design:RoomDesign;view:"plan"|"perspective"}){
  const plan=ceilingPlan(design),height=design.height??2.7,solar=solarLighting(design.lighting);
  const props=useRoomMaterial(design.ceilingMaterial??"ceiling-white",design.width,design.depth,"#ffffff");
  const geometry=useMemo(()=>{
    if(!plan.slabs.length)return null;
    const gap=plan.config.coveEnabled?Math.min(.06,plan.config.drop*.4):0;
    const parts=plan.slabs.map(b=>{const g=new THREE.BoxGeometry(b.maxX-b.minX,plan.config.drop-gap,b.maxZ-b.minZ);g.translate((b.minX+b.maxX)/2,height-plan.config.drop+(plan.config.drop-gap)/2,(b.minZ+b.maxZ)/2);return g;});
    const merged=mergeGeometries(parts);parts.forEach(g=>g.dispose());return merged;
  },[plan,height]);
  useEffect(()=>()=>geometry?.dispose(),[geometry]);
  if(!geometry || view==="plan")return null;
  const lit=solar.lampsOn&&plan.config.coveEnabled&&plan.config.coveIntensity>0;
  const samples=[...plan.innerEdges].sort((a,b)=>b.length-a.length).slice(0,4);
  return <group>
    <mesh geometry={geometry} castShadow receiveShadow raycast={()=>{}}><meshStandardMaterial {...props}/></mesh>
    {plan.config.coveEnabled&&plan.innerEdges.map((edge,index)=>{
      const x=(edge.a.x+edge.b.x)/2-edge.nx*.015,z=(edge.a.z+edge.b.z)/2-edge.nz*.015;
      return <mesh key={index} position={[x,height-Math.min(.06,plan.config.drop*.4)+.008,z]} raycast={()=>{}}>
        <boxGeometry args={[edge.nx?.01:edge.length,.012,edge.nz?.01:edge.length]}/><meshStandardMaterial color={plan.config.coveColor} emissive={plan.config.coveColor} emissiveIntensity={lit?plan.config.coveIntensity/10:0} toneMapped={false}/>
      </mesh>;
    })}
    {lit&&samples.map((edge,index)=><pointLight key={index} position={[(edge.a.x+edge.b.x)/2+edge.nx*.06,height-Math.min(.06,plan.config.drop*.4)+.02,(edge.a.z+edge.b.z)/2+edge.nz*.06]} color={plan.config.coveColor} intensity={plan.config.coveIntensity*.6/samples.length} distance={Math.max(design.width,design.depth)*1.5} decay={2}/>)}
  </group>;
}
