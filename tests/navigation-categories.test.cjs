const { test } = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { loadSource } = require("./helpers/load-source.cjs");

const { CATEGORIES } = loadSource("src/lib/products.ts");
const { STORE_TYPES, isStoreType } = loadSource("src/lib/storeTypes.ts");
const { ROOM_CATALOG_GROUPS, getRoomCatalogGroup } = loadSource("src/lib/catalogNavigation.ts");
const { CategoryMenu } = loadSource("src/components/CategoryMenu.tsx", {
  "./category-menu.css": {},
  "next/link": { default: ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children) },
  "next/image": { default: ({ fill, ...props }) => React.createElement("img", props) },
});

test("store-type URL values accept only supported merchant types", () => {
  assert.deepEqual(STORE_TYPES.map(type => type.id), ["factory", "handmade", "retail"]);
  for (const type of STORE_TYPES) {
    assert.equal(isStoreType(type.id), true);
    assert.ok(type.label && type.description);
  }
  for (const value of ["admin", "customer", "", null, undefined, {}, ["retail"]]) assert.equal(isStoreType(value), false);
});

test("room navigation covers every real catalog category without inventing product types", () => {
  const valid = new Set(CATEGORIES.map(category => category.id));
  const covered = new Set();
  assert.equal(new Set(ROOM_CATALOG_GROUPS.map(group => group.id)).size, ROOM_CATALOG_GROUPS.length);
  for (const group of ROOM_CATALOG_GROUPS) {
    assert.equal(getRoomCatalogGroup(group.id), group);
    assert.ok(group.label && group.description && group.image);
    assert.ok(group.categories.length);
    for (const category of group.categories) {
      assert.ok(valid.has(category), category);
      covered.add(category);
    }
  }
  assert.deepEqual(covered, valid);
  assert.equal(getRoomCatalogGroup("nonexistent"), undefined);
  assert.equal(getRoomCatalogGroup(null), undefined);
});

test("category dialog links to working category and room routes with labelled tabs", () => {
  const markup = renderToStaticMarkup(React.createElement(CategoryMenu, { open: false, onClose() {} }));
  assert.match(markup, /<dialog[^>]+aria-labelledby="category-menu-title"/);
  assert.match(markup, /aria-label="Ангиллын цэс хаах"/);
  assert.match(markup, /role="tablist"/);
  assert.match(markup, /id="category-tab-furniture"[^>]+aria-selected="true"/);
  assert.match(markup, /id="category-panel-rooms"[^>]+hidden=""/);
  for (const category of CATEGORIES) assert.ok(markup.includes(`href="/catalog/${category.id}"`));
  for (const group of ROOM_CATALOG_GROUPS) {
    assert.ok(markup.includes(`href="/catalog?room=${group.id}"`));
    assert.ok(markup.includes(`aria-controls="category-group-${group.id}"`));
  }
  for (const type of STORE_TYPES) assert.ok(markup.includes(`href="/stores?type=${type.id}"`));
  assert.ok(!markup.includes('href="/merchant"'));
  assert.ok(!markup.includes('href="/admin"'));
  const merchant = renderToStaticMarkup(React.createElement(CategoryMenu, { open: false, merchant: true, onClose() {} }));
  assert.ok(merchant.includes('href="/merchant"'));
  assert.ok(!merchant.includes('href="/admin"'));
});
