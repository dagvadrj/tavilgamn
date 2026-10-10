const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/load-source.cjs');
const { DimensionInput } = loadSource('src/features/kitchen-planner/components/PlannerPanels.tsx');
function inputFor(unit, onCommit) {
  const label = DimensionInput({ label: 'Room width', value: 3500, min: 2000, max: 8000, unit, onCommit });
  return label.props.children[1].props.children[0].props;
}
test('centimetre fields display human units and commit millimetres to the design', () => {
  let committed;
  const input = inputFor('см', value => { committed = value; });
  assert.equal(input.defaultValue, 350);
  assert.equal(input.min, 200);
  assert.equal(input.max, 800);
  input.onBlur({ currentTarget: { valueAsNumber: 425, value: '425' } });
  assert.equal(committed, 4250);
});
test('invalid centimetre values do not change the design, while precision fields keep millimetres', () => {
  let calls = 0;
  const cm = inputFor('см', () => { calls++; });
  cm.onBlur({ currentTarget: { valueAsNumber: 100, value: '100' } });
  cm.onBlur({ currentTarget: { valueAsNumber: NaN, value: '' } });
  assert.equal(calls, 0);
  const mm = inputFor('мм', () => {});
  assert.equal(mm.defaultValue, 3500);
  assert.equal(mm.step, 0.001);
});
