const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/load-source.cjs');
const { groupInsightSeries } = loadSource('src/features/merchant/insightSeries.ts');

test('calendar buckets preserve exact totals across weeks, months and year boundaries', () => {
  const series = [
    {date:'2026-01-01',net:'9007199254740993',gross:'9007199254740995',orders:'2'},
    {date:'2025-12-31',net:'7',gross:'9',orders:'1'},
    {date:'2026-01-05',net:'11',gross:'13',orders:'3'},
  ];
  assert.deepEqual(groupInsightSeries(series,'week'), [
    {date:'2025-12-29',net:'9007199254741000',gross:'9007199254741004',orders:'3'},
    {date:'2026-01-05',net:'11',gross:'13',orders:'3'},
  ]);
  assert.equal(groupInsightSeries(series,'month')[1].net,'9007199254741004');
  assert.equal(groupInsightSeries(series,'day')[0].date,'2025-12-31');
  assert.deepEqual(groupInsightSeries([],'week'),[]);
});
