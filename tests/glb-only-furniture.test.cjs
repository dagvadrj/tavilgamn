const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { loadSource } = require('./helpers/load-source.cjs');

test('kitchen extras render only the actual linked GLB', () => {
  const GLBFurnitureMesh = () => null;
  const { KitchenExtraMesh } = loadSource('src/three/KitchenExtraMesh.tsx', {
    './GLBFurnitureMesh': { GLBFurnitureMesh },
  });
  const extra = { width: 600, height: 2000, depth: 1500, category: 'bookshelf', color: '#ffffff', material: 'wood' };
  assert.equal(KitchenExtraMesh({ extra }), null);
  const tree = KitchenExtraMesh({ extra: { ...extra, model: { id: 'rack', file: 'rack.glb', previewFile: 'rack-preview.glb', scale: 1 } } });
  assert.equal(tree.type, GLBFurnitureMesh);
  assert.equal(tree.props.glbFile, 'rack.glb');
  assert.equal(tree.props.previewGlbFile, 'rack-preview.glb');
  assert.deepEqual([tree.props.w, tree.props.h, tree.props.d], [.6, 2, 1.5]);
});

test('the kitchen extra library offers only products with ready models', () => {
  const { ExtrasPanel } = loadSource('src/features/kitchen-planner/components/ExtrasPanel.tsx');
  const product = { id: 'photo', name: 'Photo table', category: 'dining-table', image: '/table.png', dimensions: { w: 1, d: 1, h: .8 } };
  const props = { products: [product, { ...product, id: 'ready', name: 'Ready table', model: { id: 'model', file: 'table.glb', scale: 1 } }],
    room: { width: 4000, depth: 4000 }, disabled: false, error: null, loading: false, onAdd() {}, onChange() {}, onDelete() {}, onDuplicate() {} };
  const html = renderToStaticMarkup(React.createElement(ExtrasPanel, props));
  assert.ok(html.includes('Нэмэх: Ready table'));
  assert.ok(!html.includes('Нэмэх: Photo table'));
});
