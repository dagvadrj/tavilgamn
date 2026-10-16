const {test}=require('node:test');
const assert=require('node:assert/strict');
const {mkdtemp,writeFile,rm,mkdir}=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const exec=promisify(execFile);

test('the actual delivery compressor preserves more than 8-bit authored normals',async()=>{
  const {Document,NodeIO}=await import('@gltf-transform/core');
  const {ALL_EXTENSIONS}=await import('@gltf-transform/extensions');
  const {MeshoptDecoder}=await import('meshoptimizer');
  const workspace=await mkdtemp(path.join(os.tmpdir(),'model-normal-precision-'));
  try {
    const input=path.join(workspace,'geometry');await mkdir(input);
    const doc=new Document(),buffer=doc.createBuffer();
    const positions=doc.createAccessor().setType('VEC3').setArray(new Float32Array([0,0,0,1,0,0,0,1,0])).setBuffer(buffer);
    const original=[[.1234,.2345,.9642],[.3134,.4123,.8555],[.5752,.2755,.7699]].map(v=>{const length=Math.hypot(...v);return v.map(n=>n/length)});
    const normals=doc.createAccessor().setType('VEC3').setArray(new Float32Array(original.flat())).setBuffer(buffer);
    const mesh=doc.createMesh().addPrimitive(doc.createPrimitive().setAttribute('POSITION',positions).setAttribute('NORMAL',normals).setMaterial(doc.createMaterial()));
    doc.createScene().addChild(doc.createNode().setMesh(mesh));
    const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
    await io.write(path.join(input,'delivery.glb'),doc);
    await writeFile(path.join(input,'geometry-report.json'),JSON.stringify({preservedGeometry:true,delivery:{passed:true}}));
    const output=path.join(workspace,'compressed');
    await exec(process.execPath,['scripts/models/optimize-glb.mjs','--input',input,'--output',output],{cwd:path.resolve(__dirname,'..'),windowsHide:true,maxBuffer:4*1024*1024});
    const restored=await io.read(path.join(output,'delivery.glb'));
    const normal=restored.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('NORMAL');
    assert.equal(normal.getComponentType(),5122,'high preset silently capped requested normal precision to Int8');
    for(let i=0;i<normal.getCount();i++){
      const actual=normal.getElement(i,[]),length=Math.hypot(...actual);
      const angle=Math.min(...original.map(expected=>Math.acos(Math.max(-1,Math.min(1,expected.reduce((sum,n,k)=>sum+n*actual[k]/length,0))))*180/Math.PI));
      assert.ok(angle<.06,`normal angular error ${angle} degrees`);
    }
  } finally {
    // mkdtemp creates this exact test-owned directory under the OS temp root.
    assert.equal(path.dirname(path.resolve(workspace)),path.resolve(os.tmpdir()));
    assert.match(path.basename(workspace),/^model-normal-precision-/);
    await rm(workspace,{recursive:true,force:true});
  }
});
