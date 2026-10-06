const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { loadSource } = require("./helpers/load-source.cjs");

const sofa = { id: "sofa-1", name: "Luna буйдан", description: "Зөөлөн даавуу", category: "sofa", image: "/sofa.jpg",
  basePrice: 100000, defaultColor: "cream", colors: [{ id: "cream", priceDelta: 20000 }],
  materials: [{ id: "fabric", priceDelta: 10000 }], stockQuantity: 5, inStock: true };

test("product search handles English, Mongolian and Latin category queries, multiple terms and name ranking", () => {
  const { matchesProductSearch, searchProducts } = loadSource("src/lib/productSearch.ts");
  for (const query of ["sofa", "буйдан", "buidan", "COUCH", "  Luna   sofa "]) assert.equal(matchesProductSearch(sofa, query), true, query);
  assert.equal(matchesProductSearch(sofa, "Luna leather"), false);
  assert.equal(matchesProductSearch({ name: "Chair", description: "decorative color", category: "office" }, "bed"), false);
  assert.equal(matchesProductSearch({ name: "Chair", description: "decorative color", category: "office" }, "or"), false);
  const products = [{ ...sofa, id: "description", name: "Өөр буйдан", description: "Luna" }, sofa];
  assert.deepEqual(searchProducts(products, "luna").map(p => p.id), [sofa.id, "description"]);
  assert.deepEqual(searchProducts(products, "  "), []);
  assert.deepEqual(products.map(p => p.id), ["description", sofa.id], "ranking does not mutate the catalog");
});

function harness(initial = {}) {
  const previousDocument = global.document;
  global.document = new EventTarget();
  const slots = []; let cursor = 0, effects = [], dirty = true, tree, pathname = "/";
  const catalog = { products: [], ready: false, loading: false, error: null, refreshCalls: 0,
    refresh() { this.refreshCalls++; this.loading = true; return Promise.resolve(); }, ...initial };
  catalog.refresh = catalog.refresh.bind(catalog);
  const pushes = []; let scrolls = 0;
  const react = { ...React, useId: () => "search",
    useRef(value) { return slots[cursor++] ??= { current: value }; },
    useState(value) {
      const index = cursor++, slot = slots[index] ??= { value };
      return [slot.value, next => { const value = typeof next === "function" ? next(slot.value) : next; if (!Object.is(value, slot.value)) { slot.value = value; dirty = true; } }];
    },
    useEffect(effect, deps) {
      const index = cursor++, old = slots[index];
      if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) effects.push(() => {
        old?.cleanup?.(); slots[index] = { deps, cleanup: effect() };
      });
    },
  };
  const { ProductSearch } = loadSource("src/components/ProductSearch.tsx", {
    react, "next/form": { default: "form" }, "next/link": { default: "a" }, "next/image": { default: "img" },
    "next/navigation": { usePathname: () => pathname, useRouter: () => ({ push: value => pushes.push(value) }) },
    "@/store/catalog": { useCatalogStore: () => catalog },
  });
  function nodes(node = tree) {
    if (!React.isValidElement(node)) return [];
    return [node, ...React.Children.toArray(node.props.children).flatMap(nodes)];
  }
  function render() {
    cursor = 0; dirty = false; effects = []; tree = ProductSearch();
    tree.props.ref.current = { contains: () => false, querySelectorAll: () => Array.from({ length: 6 }, () => ({ scrollIntoView() { scrolls++; } })) };
    effects.forEach(effect => effect());
  }
  const flush = () => { render(); for (let i = 0; dirty && i < 5; i++) render(); };
  flush();
  return { catalog, pushes, nodes, flush,
    get scrolls() { return scrolls; },
    input: () => nodes().find(node => node.type === "input"),
    form: () => nodes().find(node => node.type === "form"),
    enter(query) { this.input().props.onFocus(); this.input().props.onChange({ target: { value: query } }); flush(); },
    key(key) { let prevented = false; this.input().props.onKeyDown({ key, preventDefault() { prevented = true; } }); flush(); return prevented; },
    navigate(value) { pathname = value; flush(); },
    dispose() { slots.forEach(slot => slot?.cleanup?.()); global.document = previousDocument; },
  };
}

test("search loads lazily, shows six compact real-product options and navigates with arrows/Enter", () => {
  const h = harness();
  try {
    assert.equal(h.catalog.refreshCalls, 0);
    h.enter("sofa"); assert.equal(h.catalog.refreshCalls, 1);
    h.catalog.products = Array.from({ length: 8 }, (_, i) => ({ ...sofa, id: `sofa-${i}` }));
    h.catalog.ready = true; h.catalog.loading = false; h.flush();
    const options = h.nodes().filter(node => node.props.role === "option");
    assert.equal(options.length, 6);
    assert.ok(h.nodes().some(node => node.type === "b" && node.props.children === "₮130,000"));
    assert.ok(h.nodes().some(node => node.props.children === "8 илэрц"));
    assert.equal(h.key("ArrowDown"), true);
    assert.equal(h.input().props["aria-activedescendant"], "search-sofa-0");
    h.key("ArrowUp"); assert.equal(h.input().props["aria-activedescendant"], "search-sofa-5");
    assert.ok(h.scrolls >= 2, "keyboard selection remains visible in a short popover");
    assert.equal(h.key("Enter"), true);
    assert.deepEqual(h.pushes, ["/product/sofa-5"]);
    assert.equal(h.input().props["aria-expanded"], false);
  } finally { h.dispose(); }
});

test("search dismisses with Escape, outside click, blur and route changes; the search button submits the whole query", () => {
  const h = harness({ products: [sofa], ready: true });
  try {
    h.enter("Luna"); h.key("ArrowDown"); h.form().props.onSubmit(); h.flush();
    assert.deepEqual(h.pushes, []);
    assert.equal(h.form().props.action, "/catalog");
    h.enter("sofa"); h.key("Escape"); assert.equal(h.input().props["aria-expanded"], false);
    assert.equal(h.key("Enter"), false); assert.deepEqual(h.pushes, []);
    h.enter("sofa"); document.dispatchEvent(new Event("pointerdown")); h.flush();
    assert.equal(h.input().props["aria-expanded"], false);
    h.enter("sofa"); h.nodes()[0].props.onBlur({ currentTarget: { contains: () => false }, relatedTarget: null }); h.flush();
    assert.equal(h.input().props["aria-expanded"], false);
    h.enter("sofa"); h.navigate("/product/sofa-1");
    assert.equal(h.input().props["aria-expanded"], false);
  } finally { h.dispose(); }
});

test("search exposes retry and empty results without hiding the full catalog link", () => {
  const h = harness({ error: "offline" });
  try {
    h.enter("sofa"); assert.equal(h.catalog.refreshCalls, 0);
    const retry = h.nodes().find(node => node.type === "button" && node.props.children === "Дахин оролдох");
    retry.props.onClick(); assert.equal(h.catalog.refreshCalls, 1);
    h.catalog.ready = true; h.catalog.error = null; h.catalog.loading = false; h.flush();
    assert.equal(h.nodes().filter(node => node.props.role === "option").length, 0);
    assert.ok(h.nodes().some(node => node.type === "a" && node.props.href === "/catalog?q=sofa"));
    assert.ok(h.nodes().some(node => node.props.className === "search-message"));
  } finally { h.dispose(); }
});
