const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/load-source.cjs');
const { inspectGlb, validateCabinetGlb, uniqueGlbNodeNames } = loadSource('src/lib/glbStandard.ts');
const { cabinetModuleCode, cabinetVariantCode } = loadSource('src/lib/cabinetCodes.ts');
const { fixture } = require('./helpers/glb-fixture.cjs');
test('reads real vertices rather than trusting accessor metadata, in meters with bottom origin', () => {
  const report = inspectGlb(fixture());
  assert.ok(Math.abs(report.dimensions.widthMm-700)<.001); assert.equal(report.bottomCentered,true); assert.equal(report.transformsApplied,true);
  assert.deepEqual(validateCabinetGlb(report,{widthMm:700,heightMm:840,depthMm:600}),[]);
});

test('imported duplicate node names warn without blocking parts or assemblies; anchors use active unique names', () => {
  const report = inspectGlb(fixture(d => {
    d.nodes[0].name = '3DGeom'; d.nodes[0].children = [1, 2, 3];
    d.nodes.push({name:'3DGeom'}, {name:'Assembly'}, {name:'door_socket'}, {name:'door_socket'});
  }));
  assert.deepEqual(report.nodeNames, ['3DGeom', '3DGeom', 'Assembly', 'door_socket']);
  assert.deepEqual(uniqueGlbNodeNames(report.nodeNames), ['Assembly', 'door_socket']);
  assert.ok(report.warnings.some(warning => warning.includes('node')));
  for (const role of ['furniture', 'kitchen-part', 'kitchen-assembly']) {
    assert.deepEqual(validateCabinetGlb(report, {widthMm:700,heightMm:840,depthMm:600}, role), []);
  }
});
test('rejects truncation, invalid headers, external textures, animation, sparse and NaN positions', () => {
  assert.throws(()=>inspectGlb(fixture().slice(0,24)));
  for (const edit of [d=>d.images=[{uri:'https://evil.invalid/texture'}], d=>d.images=[{mimeType:'image/ktx2'}], d=>d.extensionsUsed=['EXT_meshopt_compression'], d=>d.animations=[{}], d=>d.accessors[0].sparse={}, (d,b)=>b.writeFloatLE(NaN,0), d=>d.nodes[0].children=[0], d=>d.nodes[0].mesh=999]) assert.throws(()=>inspectGlb(fixture(edit)));
});
test('100mm below floor, unapplied transforms, 740mm height and 635mm depth cannot be disguised by catalog metadata', () => {
  const below=inspectGlb(fixture(d=>d.nodes[0].translation=[0,-.1,0]));
  assert.equal(below.bottomCentered,false); assert.equal(below.transformsApplied,false);
  assert.equal(validateCabinetGlb(below,{widthMm:700,heightMm:840,depthMm:600}).length,2);
  assert.equal(validateCabinetGlb(inspectGlb(fixture()),{widthMm:700,heightMm:740,depthMm:635}).length,2);
  const handles = inspectGlb(fixture((d,b)=>{for(let i=8;i<b.length;i+=12)b.writeFloatLE(b.readFloatLE(i)*635.1/598,i)}));
  assert.equal(validateCabinetGlb(handles,{widthMm:700,heightMm:840,depthMm:600}).length,1);
  handles.frontProjectionMm=35.1;
  assert.deepEqual(validateCabinetGlb(handles,{widthMm:700,heightMm:840,depthMm:600}),[]);
  handles.frontProjectionMm=101;
  assert.ok(validateCabinetGlb(handles,{widthMm:700,heightMm:840,depthMm:600}).length>0);
});
test('canonical module and variant codes distinguish corners, actual heights and openings', () => {
  assert.equal(cabinetModuleCode('base',1000,840,600),'BASE-1000');
  assert.equal(cabinetModuleCode('corner',1000,840,600),'CORNER-BASE-1000');
  assert.equal(cabinetModuleCode('base',800,740,598),'BASE-800-H740-D598');
  assert.equal(cabinetVariantCode('BASE-600','oven',0,0),'BASE-600-OVEN');
  assert.equal(cabinetVariantCode('BASE-700','drawers',0,2),'BASE-700-2-DRAWERS');
  assert.equal(cabinetVariantCode('BASE-800-H740-D598','doors',2,0,'TOP144'),'BASE-800-H740-D598-2-DOORS-TOP144');
  assert.throws(()=>cabinetModuleCode('base',800,NaN,600));
});
