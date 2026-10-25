const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/load-source.cjs');
const { sofaConversion, categoryFacets, productFacet, categoryHref } = loadSource('src/lib/catalogFacets.ts');

test('sofa conversion keeps unknown data separate from explicit yes and no', () => {
  for (const value of ['Тийм', 'YES', 'дэлгэж ор болгодог', 'Ор болдог']) assert.equal(sofaConversion(value), 'sleeper');
  for (const value of ['Үгүй', 'no', 'Ор болдоггүй', 'Ор болгох боломжгүй', 'non-convertible']) assert.equal(sofaConversion(value), 'fixed');
  for (const value of [undefined, '', 'магадгүй', 'механизмтай']) assert.equal(sofaConversion(value), 'unspecified');
});

test('facet totals use available inventory and match the same filtering predicate', () => {
  const item=(category, value, stockQuantity=1)=>({category,inStock:stockQuantity>0,stockQuantity,specifications:{convertible:value,type:value}});
  const products=[item('sofa','Тийм'),item('sofa','Ор болдог'),item('sofa','Үгүй'),item('sofa',''),item('sofa','Тийм',0),item('bed','Тийм')];
  const facets=categoryFacets(products,'sofa');
  assert.deepEqual(facets.map(f=>[f.id,f.count]),[['sleeper',2],['fixed',1],['unspecified',1]]);
  assert.equal(products.filter(p=>p.category==='sofa'&&p.stockQuantity>0&&productFacet(p)==='sleeper').length,2);
});

test('other categories use authored types, normalize duplicates and safely encode links', () => {
  const products=['Хоёр хүний',' хоёр   хүний ','Нэг хүний',''].map(type=>({category:'bed',inStock:true,stockQuantity:1,specifications:{type}}));
  assert.deepEqual(categoryFacets(products,'bed').map(f=>[f.label,f.count]),[['Хоёр хүний',2],['Нэг хүний',1],['Төрөл тодорхойгүй',1]]);
  assert.equal(categoryHref('bed','type:a&b'),'/catalog/bed?type=type%3Aa%26b');
});
