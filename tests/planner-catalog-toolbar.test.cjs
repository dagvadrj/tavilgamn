const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { loadSource } = require('./helpers/load-source.cjs');

function nodes(node) { return !React.isValidElement(node) ? [] : [node, ...React.Children.toArray(node.props.children).flatMap(nodes)]; }

test('catalog sorting is numeric, reversible, and never mutates the original delivery order', () => {
  const { sortPlannerCatalog } = loadSource('src/features/planner/components/PlannerCatalogToolbar.tsx');
  const original = [{name:'Model 10'}, {name:'Model 2'}, {name:'Model 1'}];
  assert.deepEqual(sortPlannerCatalog(original, 'name-asc', item => item.name).map(item => item.name), ['Model 1','Model 2','Model 10']);
  assert.deepEqual(sortPlannerCatalog(original, 'name-desc', item => item.name).map(item => item.name), ['Model 10','Model 2','Model 1']);
  assert.deepEqual(sortPlannerCatalog(original, 'default', item => item.name), original);
  assert.equal(original[0].name, 'Model 10');
});

test('search and sort emit real changes while filter fields remain collapsed until requested', () => {
  let open = false, search, sort, focused = false;
  const { PlannerCatalogToolbar } = loadSource('src/features/planner/components/PlannerCatalogToolbar.tsx', {
    react: { ...React, useEffect(){}, useId(){ return 'catalog-filters'; }, useState(){ return [open, value => { open = typeof value === 'function' ? value(open) : value; }]; }, useRef(){ return {current: {focus(){ focused = true; }}}; } },
  });
  const props = {query:'',onQuery:value=>search=value,label:'Search',placeholder:'Search',filters:React.createElement('p',null,'Fields'),filterCount:2,sort:'default',onSort:value=>sort=value};
  let tree = nodes(PlannerCatalogToolbar(props));
  assert.equal(tree.find(n => n.type === 'section').props.hidden, true);
  const trigger = tree.find(n => n.props['aria-controls'] === 'catalog-filters');
  trigger.props.onClick();
  tree = nodes(PlannerCatalogToolbar(props));
  assert.equal(tree.find(n => n.type === 'section').props.hidden, false);
  tree.find(n => n.type === 'input').props.onChange({target:{value:'sofa'}});
  tree.find(n => n.type === 'select').props.onChange({target:{value:'name-desc'}});
  assert.equal(search,'sofa'); assert.equal(sort,'name-desc');
  tree[0].props.onKeyDown({key:'Escape',stopPropagation(){}});
  assert.equal(open,false); assert.equal(focused,true);
});
