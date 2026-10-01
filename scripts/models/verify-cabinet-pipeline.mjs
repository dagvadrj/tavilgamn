import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
const output=process.argv[2];
if(!output)throw new Error('Provide a completed pipeline output directory');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'draco3d.decoder':await draco3d.createDecoderModule()});
const entries=await readdir(path.join(output,'geometry'),{withFileTypes:true});
for(const entry of entries.filter(value=>value.isDirectory())) {
  const name=entry.name;
  const report=JSON.parse(await readFile(path.join(output,'geometry',name,'geometry-report.json'),'utf8'));
  for(const role of ['delivery','preview']) {
    const doc=await io.read(path.join(output,'compressed',name,`${role}.glb`));
    const scene=doc.getRoot().getDefaultScene()??doc.getRoot().listScenes()[0],bounds=getBounds(scene);
    const dims=bounds.max.map((value,i)=>value-bounds.min[i]),expected=[report.dimensionsM.w,report.dimensionsM.h,report.dimensionsM.d];
    const originOffset=[(bounds.min[0]+bounds.max[0])/2,bounds.min[1],(bounds.min[2]+bounds.max[2])/2];
    if(dims.some((value,i)=>!Number.isFinite(value)||Math.abs(value-expected[i])>.005)||originOffset.some(value=>!Number.isFinite(value)||Math.abs(value)>.002))throw new Error(`${name}/${role}: decoded bounds/origin changed`);
    let triangles=0;scene.traverse(node=>{for(const prim of node.getMesh()?.listPrimitives()??[])triangles+=(prim.getIndices()??prim.getAttribute('POSITION')).getCount()/3});
    if(role==='delivery'&&triangles!==report.placedTriangles)throw new Error(`${name}: delivery triangles changed`);
    console.log(JSON.stringify({name,role,decodedMm:dims.map(value=>Math.round(value*1000000)/1000),triangles,passed:true}));
  }
}
