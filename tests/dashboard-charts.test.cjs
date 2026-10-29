const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { loadSource } = require('./helpers/load-source.cjs');
const nodes = tree => React.isValidElement(tree) ? [tree, ...React.Children.toArray(tree.props.children).flatMap(nodes)] : [];

function harness() {
  let active = null;
  const charts = loadSource('src/features/dashboard/DashboardCharts.tsx', {
    react: { ...React, useId: () => 'chart-test', useState: () => [active, next => { active = next; }] },
  });
  return { ...charts, active: () => active };
}

test('charts show a real empty state for zero, missing, negative and non-finite values', () => {
  const { DashboardBarChart, DashboardDonut } = harness();
  for (const data of [[], [{ label: 'October', primary: 0 }], [{ label: 'Invalid', primary: NaN, secondary: Infinity }], [{ label: 'Negative', primary: -10 }]]) {
    const html = renderToStaticMarkup(DashboardBarChart({ data, primaryLabel: 'Net' }));
    assert.match(html, /v14-chart-empty/);
    assert.doesNotMatch(html, /NaN|Infinity|v14-bar-primary/);
  }
  const html = renderToStaticMarkup(DashboardDonut({ segments: [{ label: 'Net', value: 0, display: '0 ₮' }], center: '0%', caption: 'Net' }));
  assert.doesNotMatch(html, /NaN|Infinity/);
  assert.match(html, /Мэдээлэл хараахан бүртгэгдээгүй/);
});

test('keyboard and touch selections expose exact money strings and survive shorter refreshed data', () => {
  const h = harness();
  const amount = '9,007,199,254,740,993 ₮';
  const props = { data: [{ label: 'October', primary: 9007199254740992, secondary: 500, primaryDisplay: amount }], primaryLabel: 'Net', secondaryLabel: 'Fee' };
  const point = () => nodes(h.DashboardBarChart(props)).find(n => n.props.role === 'button');
  assert.ok(point().props['aria-label'].includes(amount));
  let prevented = false;
  point().props.onKeyDown({ key: 'Enter', preventDefault() { prevented = true; } });
  assert.ok(prevented);
  assert.equal(h.active(), 0);
  assert.match(renderToStaticMarkup(h.DashboardBarChart(props)), /9,007,199,254,740,993 ₮/);
  point().props.onKeyDown({ key: 'Escape' });
  assert.equal(h.active(), null);
  point().props.onClick();
  assert.equal(h.active(), 0);
  assert.doesNotThrow(() => renderToStaticMarkup(h.DashboardBarChart({ ...props, data: [] })));
});

test('line view renders both real series and donut legend selections toggle with fresh data', () => {
  const h = harness();
  const html = renderToStaticMarkup(h.DashboardBarChart({ data: [{ label: 'October', primary: 90, secondary: 10 }], primaryLabel: 'Net', secondaryLabel: 'Fee', mode: 'line' }));
  assert.match(html, /v14-chart-line-secondary/);
  assert.doesNotMatch(html, /class="v14-bar-primary"/);
  const props = { segments: [{ label: 'Net', value: 90, display: '90 ₮' }, { label: 'Fee', value: 10, display: '10 ₮' }], center: '100 ₮', caption: 'Revenue' };
  const buttons = () => nodes(h.DashboardDonut(props)).filter(n => n.type === 'button');
  buttons()[1].props.onClick();
  assert.match(renderToStaticMarkup(h.DashboardDonut(props)), /10.0%/);
  assert.doesNotThrow(() => renderToStaticMarkup(h.DashboardDonut({ ...props, segments: [] })));
  buttons()[1].props.onClick();
  assert.equal(h.active(), null);
});

test('mobile tab bar routes destinations, opens the menu and shows the action badge', () => {
  const { DashboardTabBar } = loadSource('src/features/dashboard/DashboardTabBar.tsx');
  const calls = [];
  const icon = () => null;
  const tree = DashboardTabBar({
    items: [{ id: 'dashboard', label: 'Тойм', icon }, { id: 'orders', label: 'Захиалга', icon }, { id: 'models', label: '3D', icon, badge: 3 }],
    active: 'dashboard', onChange: id => calls.push(id), create: null, onMenu: () => calls.push('menu'),
  });
  const buttons = nodes(tree).filter(n => n.type === 'button');
  assert.equal(buttons.length, 4);
  assert.equal(buttons[0].props['aria-current'], 'page');
  for (const button of buttons) button.props.onClick();
  assert.deepEqual(calls, ['dashboard', 'orders', 'models', 'menu']);
  assert.ok(nodes(tree).some(n => n.props?.className === 'dashboard-nav-badge' && n.props.children === 3));
});
