const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const THREE = require('three');
const {loadSource} = require('./helpers/load-source.cjs');

function domHarness() {
  const roots=[], nodes=[], tasks=[];let committing=false;
  const document={createElement(){
    const node={style:{},parentNode:null,remove(){if(this.parentNode){this.parentNode.children.splice(this.parentNode.children.indexOf(this),1);this.parentNode=null;}}};
    nodes.push(node);return node;
  }};
  const host=()=>({ownerDocument:document,children:[],appendChild(node){node.remove();this.children.push(node);node.parentNode=this;}});
  const renderer={createRoot(node){
    const root={node,rendered:[],unmounts:0,render(value){this.rendered.push(value);},unmount(){assert.equal(committing,false,'another React root must not unmount inside an R3F commit');this.unmounts++;}};
    roots.push(root);return root;
  }};
  return {host,roots,nodes,tasks,renderer,set committing(value){committing=value;},flush(){while(tasks.length)tasks.shift()();}};
}

test('overlay cleanup is deferred, idempotent and safe after detach/reparent',()=>{
  const h=domHarness(),original=global.queueMicrotask;global.queueMicrotask=fn=>h.tasks.push(fn);
  try {
    const {mountSceneOverlayRoot}=loadSource('src/three/sceneOverlayRoot.ts',{'react-dom/client':h.renderer});
    const first=h.host(), second=h.host(), overlay=mountSceneOverlayRoot(first);
    overlay.render('label');second.appendChild(overlay.element);
    h.committing=true;overlay.dispose();overlay.dispose();overlay.render('stale label');
    assert.equal(first.children.length,0);assert.equal(second.children.length,0);
    assert.equal(overlay.element.style.display,'none');assert.equal(h.roots[0].unmounts,0);assert.equal(h.tasks.length,1);
    assert.deepEqual(h.roots[0].rendered,['label']);
    h.committing=false;h.flush();assert.equal(h.roots[0].unmounts,1);
    const detached=mountSceneOverlayRoot(first);detached.element.remove();assert.doesNotThrow(()=>detached.dispose());h.flush();
    assert.equal(h.roots[1].unmounts,1);
  } finally {global.queueMicrotask=original;}
});

test('Strict Mode cleanup/remount and rapid target changes never reuse an old root container',()=>{
  const h=domHarness(),original=global.queueMicrotask;global.queueMicrotask=fn=>h.tasks.push(fn);
  try {
    const {mountSceneOverlayRoot}=loadSource('src/three/sceneOverlayRoot.ts',{'react-dom/client':h.renderer});
    const host=h.host();let active=mountSceneOverlayRoot(host);
    for(let i=0;i<12;i++) {
      h.committing=true;active.dispose();active=mountSceneOverlayRoot(host);active.render('current '+i);
      h.committing=false;h.flush();
      assert.deepEqual(host.children,[active.element]);assert.equal(h.roots.at(-1).unmounts,0);
    }
    assert.equal(new Set(h.nodes).size,13);assert.ok(h.roots.slice(0,-1).every(root=>root.unmounts===1));
    active.dispose();h.flush();assert.equal(host.children.length,0);assert.ok(h.roots.every(root=>root.unmounts===1));
  } finally {global.queueMicrotask=original;}
});

test('SceneHtml preserves world projection, DOM refs/callbacks, centering and demand invalidation',()=>{
  const h=domHarness(),effects=[],frames=[];let invalidations=0,clicks=0;
  const host=h.host(),gl={domElement:{parentElement:host}};
  const {SceneHtml}=loadSource('src/three/SceneHtml.tsx',{
    react:{...React,useRef:value=>({current:value}),useMemo:fn=>fn(),useLayoutEffect:fn=>effects.push(fn)},
    'react-dom/client':h.renderer,
    '@react-three/fiber':{useThree:()=>({gl,events:{connected:host},invalidate:()=>invalidations++}),useFrame:fn=>frames.push(fn)},
  });
  const original=global.queueMicrotask;global.queueMicrotask=fn=>h.tasks.push(fn);
  try {
    const child=React.createElement('button',{onClick:()=>clicks++},'Room');
    const tree=SceneHtml({position:[1,0,0],center:true,zIndexRange:[12,0],children:child});
    const parent=new THREE.Group(),anchor=new THREE.Group();parent.position.set(2,0,0);parent.add(anchor);anchor.position.fromArray(tree.props.position);tree.props.ref.current=anchor;
    const cleanups=effects.map(fn=>fn());assert.equal(h.roots.length,1);
    const content=h.roots[0].rendered[0];assert.equal(content.props.style.transform,'translate(-50%, -50%)');
    content.props.children.props.onClick();assert.equal(clicks,1);content.props.ref({});assert.equal(invalidations,2);
    const camera=new THREE.PerspectiveCamera(60,2,.1,100);camera.position.set(3,2,6);camera.lookAt(3,0,0);camera.updateMatrixWorld();
    const scene=new THREE.Scene();scene.add(parent);
    frames[0]({camera,scene,size:{width:800,height:400}});
    assert.equal(h.nodes[0].style.display,'block');assert.match(h.nodes[0].style.transform,/translate3d\(400px,200px,0\)/);
    assert.ok(Number(h.nodes[0].style.zIndex)<=12);
    parent.visible=false;frames[0]({camera,scene,size:{width:800,height:400}});assert.equal(h.nodes[0].style.display,'none');
    parent.visible=true;camera.lookAt(3,2,10);camera.updateMatrixWorld();frames[0]({camera,scene,size:{width:800,height:400}});assert.equal(h.nodes[0].style.display,'none');
    h.committing=true;cleanups[0]();assert.equal(h.roots[0].unmounts,0);h.committing=false;h.flush();assert.equal(h.roots[0].unmounts,1);
  } finally {global.queueMicrotask=original;}
});

test('interior labels occlude behind solid walls but ignore invisible picking meshes',()=>{
  const h=domHarness(),effects=[];let frame;
  const host=h.host();const {SceneHtml}=loadSource('src/three/SceneHtml.tsx',{
    react:{...React,useRef:value=>({current:value}),useMemo:fn=>fn(),useLayoutEffect:fn=>effects.push(fn)},
    'react-dom/client':h.renderer,
    '@react-three/fiber':{useThree:()=>({gl:{domElement:{parentElement:host}},events:{},invalidate(){}}),useFrame:fn=>{frame=fn;}},
  });
  const original=global.queueMicrotask;global.queueMicrotask=fn=>h.tasks.push(fn);
  const wall=new THREE.Mesh(new THREE.BoxGeometry(4,4,.2),new THREE.MeshBasicMaterial());wall.position.z=2;
  try {
    const tree=SceneHtml({occlude:true,children:'Visit room'}),anchor=new THREE.Group(),scene=new THREE.Scene();tree.props.ref.current=anchor;scene.add(anchor,wall);scene.updateMatrixWorld();
    const cleanups=effects.map(fn=>fn());const camera=new THREE.PerspectiveCamera(60,1,.1,100);camera.position.z=5;camera.lookAt(0,0,0);camera.updateMatrixWorld();
    const state={camera,scene,size:{width:400,height:400}};frame(state);assert.equal(h.nodes[0].style.display,'none');
    wall.material.transparent=true;wall.material.opacity=0;frame(state);assert.equal(h.nodes[0].style.display,'block');
    wall.material.opacity=1;wall.visible=false;frame(state);assert.equal(h.nodes[0].style.display,'block');
    cleanups[0]();h.flush();
  } finally {wall.geometry.dispose();wall.material.dispose();global.queueMicrotask=original;}
});
