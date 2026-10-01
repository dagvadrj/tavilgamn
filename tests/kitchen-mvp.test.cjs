const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadSource}=require('./helpers/load-source.cjs');
const {createSuggestedKitchen}=loadSource('src/lib/kitchenSuggestions.ts');
const {parseKitchen}=loadSource('src/lib/kitchenAssembly.ts');
const {placementIssues}=loadSource('src/lib/kitchenPlacement.ts');
const {EditorHistory}=loadSource('src/lib/editorHistory.ts');
const {createUnifiedKitchen}=loadSource('src/lib/kitchenAssembly.ts');
const {extraFromProduct,findExtraSpace}=loadSource('src/lib/kitchenExtras.ts');
const {buildKitchenBom,kitchenBomCsv,kitchenReportHtml}=loadSource('src/lib/kitchenBom.ts');
const product={id:'table-test',name:'Dining table',category:'dining-table',dimensions:{w:1,h:.75,d:.65},basePrice:250000,
  colors:[{id:'oak',hex:'#aabbcc',priceDelta:10000}],defaultColor:'oak',materials:[{id:'wood'}]};
test('undo/redo snapshots are immutable, bounded, skip no-ops and truncate redo after new edits',()=>{
  const history=new EditorHistory(2), a={value:1}, b={value:2}, c={value:3}, d={value:4};
  history.record(a,b); a.value=99;
  assert.deepEqual(history.undo(b),{value:1}); assert.deepEqual(history.redo({value:1}),b);
  history.record(b,b); assert.equal(history.undoCount,1);
  history.record(b,c); history.record(c,d); assert.equal(history.undoCount,2);
  assert.deepEqual(history.undo(d),c); history.record(c,{value:5}); assert.equal(history.redoCount,0);
});
test('extras keep real dimensions, collision-safe positions, parse roundtrip and reject unsafe GLB paths',()=>{
  const kitchen=createUnifiedKitchen(),extra=findExtraSpace(kitchen,extraFromProduct(product,'table-1'));
  assert.ok(extra);assert.equal(extra.width,1000);assert.equal(extra.color,'#aabbcc');
  kitchen.extras=[extra];
  assert.deepEqual(placementIssues(kitchen).filter(i=>i.severity==='error'),[]);
  assert.deepEqual(parseKitchen(kitchen).extras,[extra]);
  const duplicate=findExtraSpace(kitchen,{...extra,id:'table-2'});assert.ok(duplicate);
  kitchen.extras.push(duplicate);assert.equal(placementIssues(kitchen).filter(i=>i.severity==='error').length,0);
  kitchen.extras[1].position={...extra.position};assert.ok(placementIssues(kitchen).some(i=>i.severity==='error'));
  kitchen.extras=[{...extra,model:{id:'12345678-1234-1234-1234-123456789abc',file:'../secret.glb',scale:1}}];
  assert.throws(()=>parseKitchen(kitchen),/GLB/);
});
test('BOM includes assemblies, components, extra furniture and surface areas without counting included components twice',()=>{
  const kitchen=createUnifiedKitchen();kitchen.extras=[findExtraSpace(kitchen,extraFromProduct(product,'table-1'))];
  const bom=buildKitchenBom(kitchen,[],[product]);
  assert.equal(bom.knownSubtotal,260000);assert.ok(bom.unpricedCount>=kitchen.cabinets.length);
  assert.ok(bom.items.some(i=>i.included));assert.ok(bom.items.some(i=>i.unit==='м²'));
  assert.equal(bom.complete,false);
  assert.equal(buildKitchenBom(kitchen,[],[{...product,basePrice:0}]).knownSubtotal,0);
});
test('HTML report escapes all catalog/project text and rejects injected images; CSV prevents formula injection',()=>{
  const kitchen=createUnifiedKitchen(),bom={items:[{id:'x',label:'=HYPERLINK("bad")<script>alert(1)</script>',quantity:1,unit:'ш',dimensions:'x',material:'<img src=x onerror=alert(2)>',unitPrice:null,included:false}],knownSubtotal:0,unpricedCount:1,complete:false};
  const html=kitchenReportHtml('<script>name</script>',kitchen,bom,'data:image/png;base64,abc" onerror="alert(3)');
  assert.doesNotMatch(html,/<script>|<img|onerror="/);assert.match(html,/&lt;script&gt;/);assert.match(html,/&lt;img src=x onerror=alert\(2\)&gt;/);assert.match(html,/2D plan/);
  assert.match(kitchenBomCsv(bom),/"'=HYPERLINK/);
});
test('all wizard appliance/layout combinations produce saveable non-overlapping designs',()=>{
  for(const oven of ['under-worktop','high-cabinet']) for(const hood of ['none','integrated','wall'])
    for(const refrigerator of ['none','integrated','freestanding']) for(const layout of ['straight','l-right','u','double-side']) {
      const preferences={oven,hood,refrigerator,layout}, kitchen=createSuggestedKitchen(preferences);
      assert.deepEqual(placementIssues(kitchen).filter(i=>i.severity==='error'),[],JSON.stringify(preferences));
      assert.equal(parseKitchen(JSON.parse(JSON.stringify(kitchen))).layout,layout);
      if(layout==='u') assert.equal(new Set(kitchen.cabinets.filter(c=>c.type!=='wall').map(c=>c.position.rotation)).size,3);
  }
});
