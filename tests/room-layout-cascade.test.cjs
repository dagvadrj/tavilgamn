const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const selectorParser = require('postcss-selector-parser');
const { readStylesheet } = require('../scripts/styles/read.cjs');

// Resolve only the simple class/tag selectors that govern editor geometry.
// This guards stylesheet injection order, alongside browser layout checks.
const shared = [
  'src/components/room-planner.css',
  'src/features/planner/components/planner-studio.css',
  'src/features/planner/components/planner-reference.css',
  'src/features/planner/components/planner-usability.css',
  'src/features/room-planner/components/room-template-admin.css',
];
const own = 'src/features/room-planner/components/room-planner-simple.css';
const sheets = new Map([...shared, own].map(file => [file, readStylesheet(file)]));
const planner = fs.readFileSync('src/components/RoomPlanner.tsx', 'utf8');
const rootClasses = planner.match(/"(room-planner-layout [^"]+)"/)[1].split(/\s+/);
const element = (classes, tag = 'div') => ({ classes: new Set(classes.split(/\s+/)), tag });

function matches(selector, ancestors) {
  const parts = [{ nodes: [], relation: null }];
  for (const node of selector.nodes) {
    if (node.type === 'combinator') parts.push({ nodes: [], relation: node.value.trim() || ' ' });
    else if (!['class', 'tag', 'universal'].includes(node.type)) return false;
    else parts.at(-1).nodes.push(node);
  }
  function at(part, index) {
    if (index < 0) return false;
    if (!parts[part].nodes.every(node => node.type === 'universal' || (node.type === 'tag' ? node.value === ancestors[index].tag : ancestors[index].classes.has(node.value)))) return false;
    if (part === 0) return true;
    if (parts[part].relation === '>') return at(part - 1, index - 1);
    if (parts[part].relation !== ' ') return false;
    for (let parent = index - 1; parent >= 0; parent--) if (at(part - 1, parent)) return true;
    return false;
  }
  return at(parts.length - 1, ancestors.length - 1);
}

function computed(order, ancestors, width, height = 900) {
  const winners = new Map();
  for (const file of order) sheets.get(file).walkRules(rule => {
    for (let parent = rule.parent; parent; parent = parent.parent) {
      if (parent.type !== 'atrule' || parent.name !== 'media') continue;
      for (const condition of parent.params.matchAll(/(min|max)-(width|height)\s*:\s*(\d+)px/g)) {
        const actual = condition[2] === 'width' ? width : height;
        if (condition[1] === 'min' ? actual < Number(condition[3]) : actual > Number(condition[3])) return;
      }
      if (/print|prefers-reduced-motion/.test(parent.params)) return;
    }
    for (const selector of selectorParser().astSync(rule.selector).nodes) {
      if (!matches(selector, ancestors)) continue;
      let specificity = 0;
      selector.walk(node => { if (node.type === 'class') specificity += 100; if (node.type === 'tag') specificity++; });
      for (const declaration of rule.nodes.filter(node => node.type === 'decl')) {
        const score = specificity + (declaration.important ? 100000 : 0);
        if (!winners.has(declaration.prop) || winners.get(declaration.prop).score <= score) winners.set(declaration.prop, { score, value: declaration.value });
      }
    }
  });
  return Object.fromEntries([...winners].map(([key, entry]) => [key, entry.value.replace(/\s+/g, '')]));
}

const orders = [[...shared, own], [own, ...shared], [own, ...shared.toReversed()], [...shared.slice(0, 2), own, ...shared.slice(2)]];

test('room canvas stays in the first column with no phantom rail for every shared CSS loading order', () => {
  assert.ok(!rootClasses.includes('room-reference'), 'the one-inspector editor must not opt into the legacy rail layout');
  for (const order of orders) for (const width of [1920, 1280, 1100, 959, 390]) for (const open of [false, true]) {
    const root = element([...rootClasses, ...(open ? ['room-panel-open'] : [])].join(' '));
    const layout = computed(order, [root], width);
    assert.equal(layout.display, 'grid');
    assert.equal(layout['grid-template-columns'], open && width > 959 ? 'minmax(0,1fr)360px' : 'minmax(0,1fr)', `${width}px open=${open} own stylesheet at ${order.indexOf(own)}`);
    assert.equal(computed(order, [root, element('planner-stage')], width)['grid-column'], '1');
    assert.equal(computed(order, [root, element('planner-stage')], width)['grid-row'], '1');
    if (open) {
      const drawer = computed(order, [root, element('planner-drawer', 'aside')], width);
      assert.equal(drawer.position, width > 959 ? 'relative' : 'fixed');
      assert.equal(computed(order, [root, element('planner-drawer', 'aside'), element('planner-drawer-heading')], width).display, 'flex');
    }
  }
});

test('room caption cannot stretch into a white panel when shared studio styles load after the editor', () => {
  for (const order of orders) for (const width of [1920, 1100, 959, 390]) {
    const root = element(rootClasses.join(' '));
    const caption = computed(order, [root, element('planner-stage'), element('planner-room-caption')], width);
    assert.equal(caption.top, 'auto');
    assert.equal(caption.background, 'none');
    assert.equal(caption.border, '0');
    assert.equal(caption['box-shadow'], 'none');
  }
});

test('admin toolbar clearance and expanded mode remain independent of shared CSS load order', () => {
  for (const order of orders) {
    const root = element([...rootClasses, 'room-admin-mode', 'planner-expanded'].join(' '));
    assert.equal(computed(order, [root], 1920).position, 'fixed');
    assert.equal(computed(order, [root], 1920)['padding-top'], 'calc(var(--reference-header)+56px)');
    assert.equal(computed(order, [root], 390)['padding-top'], 'calc(var(--reference-header)+100px)');
  }
});
