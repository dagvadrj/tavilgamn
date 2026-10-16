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
