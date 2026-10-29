const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/load-source.cjs');
const { roomPlannerCatalog, catalogEligible } = loadSource('src/lib/roomCatalogPolicy.ts');
const item = (id, category, extra = {}) => ({ id, name: id, category, description: '', inStock: true, stockQuantity: 2, ...extra });
const options = { roomType: 'living', scope: 'room', category: 'all', query: '', format: 'all' };

test('room changes normalize category and products together, preserving search', () => {
  const photos = [item('sofa', 'sofa'), item('oak bed', 'bed')];
  const models = [item('oak dresser', 'dresser'), item('pine bed', 'bed')];
  const result = roomPlannerCatalog(photos, models, { ...options, roomType: 'bedroom', category: 'sofa', query: 'oak' });
  assert.equal(result.category, 'all');
  assert.deepEqual(result.photos.map(p => p.id), ['oak bed']);
  assert.deepEqual(result.models.map(p => p.id), ['oak dresser']);
  assert.equal(result.categories.find(c => c.id === 'bed').count, 1);
});

test('a shared-room category in only one format never leaks unrelated items from the other format', () => {
  const photos = [item('bed', 'bed')];
  const models = [item('shared chair', 'chair', { roomTypes: ['bedroom', 'living'] })];
  for (const format of ['all', 'photo', 'glb']) {
    const result = roomPlannerCatalog(photos, models, { ...options, roomType: 'bedroom', category: 'chair', format });
    assert.equal(result.category, 'chair');
    assert.deepEqual(result.photos, []);
    assert.deepEqual(result.models.map(p => p.id), ['shared chair']);
    assert.equal(result.categories.find(c => c.id === 'chair').count, format === 'photo' ? 0 : 1);
  }
});

test('category counts follow format and search while format totals retain alternatives', () => {
  const photos = [item('oak photo', 'sofa'), item('pine photo', 'sofa')];
  const models = [item('oak model', 'sofa'), item('sold out', 'sofa', { stockQuantity: 0 })];
  for (const format of ['all', 'photo', 'glb']) {
    const result = roomPlannerCatalog(photos, models, { ...options, query: 'oak', format });
    assert.equal(result.categories.find(c => c.id === 'sofa').count, format === 'all' ? 2 : 1);
    assert.equal(result.photos.length, 1);
    assert.equal(result.models.length, 1);
  }
});

test('authored room selection takes priority in every room, all-room browse remains explicit', () => {
  const officeSofa = item('office sofa', 'sofa', { roomTypes: ['office'] });
  assert.equal(catalogEligible(officeSofa, 'living', 'room'), false);
  assert.equal(catalogEligible(officeSofa, 'other', 'room'), false);
  assert.equal(catalogEligible(officeSofa, 'office', 'room'), true);
  assert.equal(catalogEligible(officeSofa, 'living', 'all'), true);
  assert.equal(catalogEligible(item('legacy sofa', 'sofa'), 'living', 'room'), true);
  assert.equal(catalogEligible(item('legacy sofa', 'sofa'), 'other', 'room'), true);
});

test('the default room scope is the starting view, not an active filter', () => {
  const { activeRoomCatalogFilters, DEFAULT_ROOM_CATALOG_FILTERS: defaults } = loadSource('src/lib/roomCatalogPolicy.ts');
  assert.equal(defaults.scope, 'room');
  assert.equal(activeRoomCatalogFilters(defaults), 0, 'nothing chosen, nothing to clear');
  assert.equal(activeRoomCatalogFilters({ ...defaults, query: '   ' }), 0, 'blank search is no filter');
  assert.equal(activeRoomCatalogFilters({ ...defaults, scope: 'all' }), 1, 'widening to every room is a choice');
  assert.equal(activeRoomCatalogFilters({ ...defaults, category: 'sofa', query: 'oak', format: 'glb', merchant: 's1' }), 4);
  assert.equal(activeRoomCatalogFilters({ ...defaults, merchant: 's1' }, true), 0, "a merchant editor's own store is not a choice");
});

test('«Шүүлтүүр цэвэрлэх» appears only for chosen filters and reset returns to the room scope', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { RoomCatalogFilters } = loadSource('src/features/room-planner/components/RoomCatalogFilters.tsx');
  const noop = () => {};
  const props = { categories: [{ id: 'sofa', name: 'Буйдан', count: 2 }], category: 'all', onCategory: noop, scope: 'room', onScope: noop,
    merchant: 'all', merchants: [], onMerchant: noop, format: 'all', onFormat: noop, sort: 'default', onSort: noop,
    roomName: 'Зочны өрөө', query: '', onQuery: noop, count: 2, onReset: noop };
  const render = (extra) => renderToStaticMarkup(React.createElement(RoomCatalogFilters, { ...props, ...extra }));
  assert.doesNotMatch(render({}), /Шүүлтүүр цэвэрлэх/, 'the default room scope shows no clear button');
  assert.match(render({ category: 'sofa' }), /Шүүлтүүр цэвэрлэх/);
  assert.match(render({ scope: 'all' }), /Шүүлтүүр цэвэрлэх/);
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '../src/components/RoomPlanner.tsx'), 'utf8').replace(/\r\n/g, '\n');
  const reset = source.slice(source.indexOf('const resetCatalogFilters = '), source.indexOf('\n  };', source.indexOf('const resetCatalogFilters = ')));
  assert.match(reset, /setCatalogScope\(DEFAULT_ROOM_CATALOG_FILTERS\.scope\)/, 'clearing keeps the room scope');
  assert.doesNotMatch(reset, /setCatalogScope\("all"\)/);
});
