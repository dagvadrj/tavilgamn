const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadSource}=require('./helpers/load-source.cjs');
const math=loadSource('src/features/dashboard/overviewMath.ts');
const point=(date,gross,net,orders)=>({date,gross:String(gross),net:String(net),orders:String(orders)});

test('formatMNT uses one shared scale: сая / мян / ₮',()=>{
 assert.deepEqual(math.formatMNT(48_600_000n),{value:'48.6',unit:'сая ₮'});
 assert.deepEqual(math.formatMNT(2_430_000n),{value:'2.43',unit:'сая ₮'});
 assert.deepEqual(math.formatMNT(2_000_000n),{value:'2',unit:'сая ₮'});
 assert.deepEqual(math.formatMNT(227_400n),{value:'227',unit:'мян ₮'});
 assert.deepEqual(math.formatMNT(0n),{value:'0',unit:'₮'});
});

test('range summary compares with the equal period before and hides deltas without one',()=>{
 const series=[point('2026-10-01',100,10,1),point('2026-10-02',100,10,1),point('2026-10-03',300,30,2),point('2026-10-04',100,10,1)];
 const two=math.summarizeRange(series,2);
 assert.equal(two.totals.gross,400n);assert.equal(two.totals.merchant,360n);assert.equal(two.totals.orders,3n);assert.equal(two.totals.average,133n);
 assert.equal(two.deltas.gross,100);assert.equal(two.commissionRate,10);
 const four=math.summarizeRange(series,4);
 assert.equal(four.deltas.gross,null);assert.equal(four.previous,null);
 assert.equal(math.summarizeRange([point('2026-10-01',0,0,0)],1).commissionRate,null);
});

test('delta formatting is monochrome text with a true minus sign',()=>{
 assert.equal(math.formatDelta(12.4),'+12.4%');assert.equal(math.formatDelta(-3.2),'−3.2%');assert.equal(math.formatDelta(null),'');
});

test('micro bars group any range into at most 24 bars without losing totals',()=>{
 const series=Array.from({length:90},(_,i)=>point(`2026-01-${i}`,1,0,0));
 const bars=math.microBars(series,p=>BigInt(p.gross));
 assert.ok(bars.length<=24);assert.equal(bars.reduce((a,b)=>a+b,0n),90n);
});

test('date labels are Mongolian and relative ages are compact',()=>{
 assert.equal(math.rangeLabel('2026-09-29','2026-10-29'),'9-р сарын 29 – 10-р сарын 29, 2026');
 assert.equal(math.dayLabel('2026-10-23'),'10.23 · Баасан');
 const now=Date.parse('2026-10-29T12:00:00Z');
 assert.equal(math.relativeAge('2026-10-29T11:58:00Z',now),'2м');
 assert.equal(math.relativeAge('2026-10-29T11:00:00Z',now),'1ц');
 assert.equal(math.relativeAge('2026-10-28T12:00:00Z',now),'1ө');
});
