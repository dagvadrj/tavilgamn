const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { loadSource } = require('./helpers/load-source.cjs');
const { KITCHEN_WORKFLOW_STEPS, kitchenWorkflowStep, KITCHEN_FLOW_STAGES, kitchenPreferences, updateKitchenEquipment, restoreKitchenPreferences, saveKitchenFlowDraft } = loadSource('src/lib/kitchenFlow.ts');
const { createSuggestedKitchen, DEFAULT_KITCHEN_SUGGESTION } = loadSource('src/lib/kitchenSuggestions.ts');
const { parseKitchen } = loadSource('src/lib/kitchenAssembly.ts');
const { KitchenPlannerHeader } = loadSource('src/features/kitchen-planner/components/KitchenPlannerHeader.tsx');
function nodes(node) { return !React.isValidElement(node) ? [] : [node, ...React.Children.toArray(node.props.children).flatMap(nodes)]; }
test('all four public header steps can be revisited without changing the furnished plan', () => {
  const kitchen = createSuggestedKitchen(DEFAULT_KITCHEN_SUGGESTION, { width: 4, depth: 4, height: 2.7 });
  kitchen.cabinets[0].color = '#224433'; kitchen.cabinets[0].variantId = '11111111-2222-4333-8444-555555555555';
  const before = JSON.stringify(kitchen), visits = [];
  const tree = KitchenPlannerHeader({ stage: 'design', onStage: stage => visits.push(stage), onTool() {}, busy: false, canUndo: false, canRedo: false, onUndo() {}, onRedo() {}, loginHref: '/', name: 'Saved', onName() {}, subtotal: 0, utilities: null, annotations: true });
  const nav = nodes(tree).find(n => n.type === 'nav');
  const buttons = nodes(nav).filter(n => n.type === 'button');
  assert.equal(buttons.length, 4);
  for (const button of [...buttons, ...buttons.toReversed()]) button.props.onClick();
  const publicSteps = KITCHEN_WORKFLOW_STEPS.map(step => step.id);
  assert.deepEqual(visits, [...publicSteps, ...publicSteps.toReversed()]);
  assert.equal(updateKitchenEquipment(kitchen, kitchenPreferences(kitchen)), kitchen);
  assert.equal(JSON.stringify(kitchen), before);
});
test('reload retains each active step, dimensions, selected models, materials, and pending answers', () => {
  const kitchen = createSuggestedKitchen(DEFAULT_KITCHEN_SUGGESTION, { width: 4, depth: 4, height: 2.7 });
  kitchen.cabinets[0].color = '#224433'; kitchen.cabinets[0].variantId = '11111111-2222-4333-8444-555555555555';
  const storage = new Map(), preferences = { ...kitchenPreferences(kitchen), hood: 'none' };
  for (const stage of KITCHEN_FLOW_STAGES) {
    const href = saveKitchenFlowDraft({ setItem: (key, value) => storage.set(key, value) }, { draftId: 'draft', userId: 'account', design: kitchen, preferences, stage });
    assert.ok(href.includes('draft=draft'));
    const saved = JSON.parse(storage.get('tavilga-kitchen-draft-account-draft'));
    assert.equal(saved.flowStage, stage);
    const restored = parseKitchen(saved.design);
    assert.deepEqual(restored.room, kitchen.room);
    assert.deepEqual(restored.cabinets.map(c => [c.id,c.position,c.color,c.variantId]), kitchen.cabinets.map(c => [c.id,c.position,c.color,c.variantId]));
    assert.deepEqual(restoreKitchenPreferences(saved.preferences, restored), preferences);
  }
  assert.equal(storage.has('tavilga-kitchen-draft-guest-draft'), false);
});
test('changing a hood choice preserves every unrelated cabinet and its manual placement', () => {
  const kitchen = createSuggestedKitchen(DEFAULT_KITCHEN_SUGGESTION, { width: 4, depth: 4, height: 2.7 });
  const next = updateKitchenEquipment(kitchen, { ...kitchenPreferences(kitchen), hood: 'none' });
  assert.equal(next.cabinets.some(c => c.opening === 'hood'), false);
  assert.deepEqual(next.cabinets, kitchen.cabinets.filter(c => c.opening !== 'hood'));
  assert.equal(next.room, kitchen.room);
  assert.equal(next.extras, kitchen.extras);
});

test('the shared continue action opens the estimate without requiring suggestions', () => {
  const visits = [], props = { stage:'design',onStage:stage=>visits.push(stage),onTool(){},busy:false,canUndo:false,canRedo:false,onUndo(){},onRedo(){},loginHref:'/',name:'Saved',onName(){},subtotal:0,utilities:null,annotations:false };
  const tree = KitchenPlannerHeader(props);
  const actions = nodes(tree).filter(n=>n.type==='button'&&['kitchen-mobile-continue','kitchen-toolbar-continue'].includes(n.props.className));
  assert.equal(actions.length,1);actions.forEach(n=>n.props.onClick());assert.deepEqual(visits,['finish']);
  assert.ok(nodes(KitchenPlannerHeader({...props,busy:true})).filter(n=>n.type==='button'&&['kitchen-mobile-continue','kitchen-toolbar-continue'].includes(n.props.className)).every(n=>n.props.disabled));
  assert.equal(nodes(KitchenPlannerHeader({...props,stage:'space'})).some(n=>n.props.className==='kitchen-mobile-continue'),false);
});

test('legacy setup stages retain a single room step and suggestions remain optional', () => {
  for (const stage of ['room', 'size', 'equipment', 'space']) assert.equal(kitchenWorkflowStep(stage), 'space');
  assert.equal(kitchenWorkflowStep('suggestions'), 'design');
  assert.equal(kitchenWorkflowStep('measurement'), 'measurement');
});

test('empty projects cannot continue from an estimate into a measurement request', () => {
  const props = { stage:'finish',onStage(){},onTool(){},busy:false,canUndo:false,canRedo:false,onUndo(){},onRedo(){},loginHref:'/',name:'Draft',onName(){},subtotal:0,utilities:null,annotations:false,itemCount:0 };
  const tree = nodes(KitchenPlannerHeader(props));
  assert.ok(tree.find(n => n.props.className === 'kitchen-toolbar-continue').props.disabled);
  const nav = tree.find(n => n.type === 'nav');
  assert.ok(nodes(nav).filter(n => n.type === 'button').at(-1).props.disabled);
});
