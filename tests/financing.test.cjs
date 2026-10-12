const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/load-source.cjs');
const { financingEstimate } = loadSource('src/lib/financing.ts');

test('zero-interest installments distribute rounding without losing principal', () => {
  const result = financingEstimate(1200003, 0, 4, 0);
  assert.deepEqual(result.rows.map(row => row.payment), [300001, 300001, 300001, 300000]);
  assert.equal(result.totalPayment, 1200003);
  assert.equal(result.rows.at(-1).balance, 0);
});

test('annuity schedule reconciles principal, interest, upfront down payment and fee', () => {
  const result = financingEstimate(3350000, 20, 12, 1.8, 1);
  assert.equal(result.downPayment, 670000);
  assert.equal(result.principal, 2680000);
  assert.equal(result.fee, 26800);
  assert.equal(result.rows[0].interest, 48240);
  assert.equal(result.rows.reduce((sum, row) => sum + row.principal, 0), result.principal);
  assert.equal(result.rows.reduce((sum, row) => sum + row.payment, 0) + result.downPayment + result.fee, result.totalPayment);
  assert.equal(result.rows.at(-1).balance, 0);
  assert.ok(result.rows.every(row => row.balance >= 0 && row.payment === row.principal + row.interest));
});

test('full down payment and zero price produce no interest or fee', () => {
  for (const result of [financingEstimate(10000, 100, 12, 1.8, 1), financingEstimate(0, 0, 12, 1.8, 1)]) {
    assert.equal(result.principal, 0);
    assert.equal(result.fee, 0);
    assert.equal(result.totalInterest, 0);
    assert.ok(result.rows.every(row => row.payment === 0));
  }
});

test('invalid finance inputs do not produce misleading results', () => {
  for (const args of [[NaN,0,12,1.8], [Infinity,0,12,1.8], [-1,0,12,1.8], [100,101,12,1.8], [100,0,0,1.8], [100,0,2.5,1.8], [100,0,12,-1], [100,0,12,NaN], [100,0,12,1.8,11]]) assert.equal(financingEstimate(...args), null);
});

test('near-zero interest remains finite and spreads principal across periods', () => {
  const result = financingEstimate(1200000, 0, 12, 1e-20);
  assert.equal(result.rows[0].payment, 100000);
  assert.equal(result.rows.at(-1).balance, 0);
  assert.equal(result.totalPayment, 1200000);
});
