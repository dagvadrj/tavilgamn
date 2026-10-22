const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadSource } = require("./helpers/load-source.cjs");
const { kitchenDesignSuggestions } = loadSource("src/lib/kitchenDesignSuggestions.ts");
const { createSuggestedKitchen, DEFAULT_KITCHEN_SUGGESTION } = loadSource("src/lib/kitchenSuggestions.ts");
const { parseKitchen } = loadSource("src/lib/kitchenAssembly.ts");

test("room drafting shows water and power controls without furniture or decoration tools", () => {
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const { KitchenSpaceEditor } = loadSource("src/features/kitchen-planner/components/KitchenSpaceEditor.tsx");
  const html = renderToStaticMarkup(React.createElement(KitchenSpaceEditor, {
    kitchen: createSuggestedKitchen(DEFAULT_KITCHEN_SUGGESTION), disabled: false,
    onChange() { return true; }, onClose() {}, onReview() {}, onSelectCabinet() {},
  }));
  assert.match(html, /Цэвэр\/бохир ус/);
  assert.match(html, /Цахилгааны холболт/);
  assert.match(html, /data-room-point/);
  assert.doesNotMatch(html, /kroom-catalog|Тавцан ба фасад|Багана нэмэх|ХААЛГА, ЦОНХ|Өнгө сонгох/);
});

test("up to five valid proposals preserve the user's room and cabinet identities without mutating their draft", () => {
  for (const size of [2, 3, 5]) {
    const kitchen = createSuggestedKitchen(DEFAULT_KITCHEN_SUGGESTION, { width: size, depth: 3, height: 2.7 });
    const before = structuredClone(kitchen);
    const proposals = kitchenDesignSuggestions(kitchen);
    assert.ok(proposals.length > 0 && proposals.length <= 5);
    for (const proposal of proposals) {
      assert.deepEqual(proposal.design.room, before.room);
      assert.deepEqual(proposal.design.cabinets.map(c => c.id).sort(), before.cabinets.map(c => c.id).sort());
      assert.equal(proposal.issue, undefined);
      assert.doesNotThrow(() => parseKitchen(proposal.design));
      if (!proposal.fits) assert.deepEqual(proposal.design.cabinets.map(c => c.position), before.cabinets.map(c => c.position));
    }
    assert.deepEqual(kitchen, before);
  }
});

test("suggestions are unique, deterministic and preserve every cabinet specification", () => {
  const { suggestionSignature }=loadSource('src/lib/kitchenDesignSuggestions.ts');
  const kitchen=createSuggestedKitchen(DEFAULT_KITCHEN_SUGGESTION,{width:5,depth:4,height:2.7});
  const proposals=kitchenDesignSuggestions(kitchen);
  assert.equal(new Set(proposals.map(p=>suggestionSignature(p.design))).size,proposals.length);
  assert.deepEqual(kitchenDesignSuggestions(kitchen),proposals);
  for(const p of proposals)for(const cabinet of p.design.cabinets){
    const {position,...spec}=cabinet;
    const {position:oldPosition,...oldSpec}=kitchen.cabinets.find(c=>c.id===cabinet.id);
    assert.deepEqual(spec,oldSpec);
  }
});

test("locked appliances never move, and empty or impossible plans do not invent color alternatives",()=>{
  const {createModularKitchen,createCabinet}=loadSource('src/lib/kitchenCabinets.ts');
  const kitchen=createSuggestedKitchen(DEFAULT_KITCHEN_SUGGESTION,{width:5,depth:4,height:2.7});
  const locked=kitchenDesignSuggestions(kitchen,{lockAppliances:true,goal:'minimal'});
  assert.ok(locked.length>0);
  for(const p of locked)for(const c of p.design.cabinets.filter(c=>['sink','hob','oven','hood','refrigerator'].includes(c.opening))){
    assert.deepEqual(c.position,kitchen.cabinets.find(o=>o.id===c.id).position);
  }
  assert.deepEqual(kitchenDesignSuggestions({...createModularKitchen(),cabinets:[]}),[]);
  const huge=createCabinet('base','huge',1000);
  assert.deepEqual(kitchenDesignSuggestions({...createModularKitchen(),room:{width:500,depth:500,height:2600},cabinets:[huge]}),[]);
});

test("the selected objective changes the first recommendation and metrics are reproducible",()=>{
  const {kitchenSuggestionMetrics}=loadSource('src/lib/kitchenDesignSuggestions.ts');
  const kitchen=createSuggestedKitchen(DEFAULT_KITCHEN_SUGGESTION,{width:5,depth:4,height:2.7});
  for(const [goal,title] of [['minimal','Бага өөрчлөлт'],['space','Сул зай'],['prep','Ажлын тавцан']]){
    const proposals=kitchenDesignSuggestions(kitchen,{goal});
    assert.equal(proposals[0].title,proposals[0].current?"Одоогийн байрлал":title);
    for(const p of proposals)assert.deepEqual(p.metrics,kitchenSuggestionMetrics(p.design,kitchen));
    if(goal==='minimal')assert.equal(proposals[0].metrics.moved,0);
    if(goal==='space')assert.ok(proposals[0].metrics.space>=Math.max(...proposals.map(p=>p.metrics.space))-1);
  }
});

test("tall and wall cabinets covering the rendered window aperture are excluded",()=>{
  const {kitchenDesignSuggestionResult}=loadSource('src/lib/kitchenDesignSuggestions.ts');
  const {createCabinet,createModularKitchen}=loadSource('src/lib/kitchenCabinets.ts');
  const c=createCabinet('tall','tall',600,2600);
  const kitchen={...createModularKitchen(),room:{width:600,depth:650,height:2600,items:[{id:'window',kind:'window',wall:'back',x:300,z:0,width:600,depth:50}]},cabinets:[c]};
  const result=kitchenDesignSuggestionResult(kitchen);
  assert.equal(result.suggestions.length,0);
  assert.ok(result.rejected.windows>0);
});

test("identical cupboards cannot become separate recommendations merely by exchanging IDs",()=>{
  const {suggestionSignature}=loadSource('src/lib/kitchenDesignSuggestions.ts');
  const {createCabinet,createModularKitchen}=loadSource('src/lib/kitchenCabinets.ts');
  const a=createCabinet('base','a'),b=createCabinet('base','b');b.position.x=900;
  const k={...createModularKitchen(),cabinets:[a,b]};
  const renamed={...k,cabinets:[{...a,id:'b'},{...b,id:'a'}]};
  assert.equal(suggestionSignature(k),suggestionSignature(renamed));
});
