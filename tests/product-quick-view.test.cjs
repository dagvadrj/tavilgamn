const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { loadSource } = require("./helpers/load-source.cjs");

test("quick view handles modal focus, backdrop, Escape, scroll restoration and stale close events", () => {
  const previousDocument = global.document;
  const previousHTMLElement = global.HTMLElement;
  let restored = false, dismissed = 0, effect;
  class Element {
    isConnected = true;
    focus() { restored = true; }
  }
  global.HTMLElement = Element;
  global.document = { body: { style: { overflow: "auto" } }, activeElement: new Element() };
  const refs = [];
  const { ProductQuickView } = loadSource("src/components/ProductQuickView.tsx", {
    react: {
      ...React,
      useRef(value) { const ref = { current: value }; refs.push(ref); return ref; },
      useId() { return "quick-title"; },
      useEffect(callback) { effect = callback; },
      useState(value) { return [value, () => {}]; },
      useCallback(callback) { return callback; },
    },
    "react-dom": { createPortal: element => element },
  });
  try {
    const product = {
      id: "sofa", name: "Буйдан", category: "sofa", description: "", image: "",
      dimensions: { w: 2, d: 1, h: .8 }, stockQuantity: 0, inStock: false,
      rating: 0, reviewCount: 0,
    };
    const node = ProductQuickView({
      product, price: 1000000, compareAtPrice: null, selection: null,
      viewHref: "/product/sofa?view=3d", detailHref: "/product/sofa",
      cartMessage: "", onAddToCart() {}, onClose() { dismissed++; },
    });
    assert.equal(node.type, "dialog");
    assert.equal(node.props["aria-labelledby"], "quick-title");
    const native = {
      open: false,
      showModal() { this.open = true; },
      close() { this.open = false; },
      getBoundingClientRect() { return { left: 100, right: 900, top: 100, bottom: 600 }; },
    };
    refs[0].current = native;
    const cleanup = effect();
    assert.equal(native.open, true);
    assert.equal(document.body.style.overflow, "hidden");
    node.props.onClose(); // Ignore a queued close event when Strict Mode has reopened it.
    assert.equal(dismissed, 0);
    node.props.onPointerDown({ target: native, currentTarget: native });
    node.props.onClick({ target: native, currentTarget: native, clientX: 10, clientY: 10 });
    assert.equal(dismissed, 1);
    node.props.onPointerDown({ target: {}, currentTarget: native });
    node.props.onClick({ target: native, currentTarget: native, clientX: 10, clientY: 10 });
    assert.equal(dismissed, 1); // Dragging from content to backdrop must not dismiss.
    let prevented = false;
    node.props.onCancel({ preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(dismissed, 2);
    const children = [];
    const visit = value => {
      if (!value || typeof value !== "object") return;
      children.push(value);
      React.Children.forEach(value.props?.children, visit);
    };
    visit(node);
    assert.equal(children.find(child => child.props?.className === "product-quick-cart").props.disabled, true);
    assert.ok(!children.some(child => child.props?.className === "product-quick-rating"));
    cleanup();
    assert.equal(native.open, false);
    assert.equal(document.body.style.overflow, "auto");
    assert.equal(restored, true);
  } finally {
    if (previousDocument === undefined) delete global.document;
    else global.document = previousDocument;
    if (previousHTMLElement === undefined) delete global.HTMLElement;
    else global.HTMLElement = previousHTMLElement;
  }
});

test("quick view loads the actual selected model in place and releases the viewer in photo mode", () => {
  const previousDocument = global.document;
  global.document = { body: {} };
  const values = [];
  let cursor = 0, dynamicOptions;
  const Viewer = () => null;
  const { ProductQuickView } = loadSource("src/components/ProductQuickView.tsx", {
    react: {
      ...React,
      useRef(value) { return { current: value }; },
      useId() { return "quick-title"; },
      useEffect() {},
      useCallback(callback) { return callback; },
      useState(value) {
        const index = cursor++;
        if (!(index in values)) values[index] = value;
        return [values[index], next => { values[index] = typeof next === "function" ? next(values[index]) : next; }];
      },
    },
    "react-dom": { createPortal: element => element },
    "next/dynamic": { default: (_loader, options) => { dynamicOptions = options; return Viewer; } },
  });
  const color = { id: "oak", name: "Oak", hex: "#c9aa80" };
  const material = { id: "wood", name: "Wood", priceDelta: 0 };
  const product = {
    id: "chair", name: "Сандал", category: "chair", description: "", image: "/chair.jpg",
    model: { id: "real-chair", file: "delivery.glb", previewFile: "preview.glb", physicalSize: true },
    dimensions: { w: .6, d: .55, h: .9 }, colors: [color], materials: [material], defaultColor: color.id,
    stockQuantity: 3, inStock: true, rating: 0, reviewCount: 0,
  };
  const props = {
    product, price: 100000, compareAtPrice: null, selection: { color, material, unitPrice: 100000 },
    viewHref: "/product/chair?color=oak&view=3d", detailHref: "/product/chair?color=oak",
    cartMessage: "", onAddToCart() {}, onClose() {},
  };
  function render(extra = {}) {
    cursor = 0;
    const nodes = [];
    const visit = node => {
      if (!React.isValidElement(node)) return;
      nodes.push(node);
      React.Children.forEach(node.props.children, visit);
    };
    visit(ProductQuickView({ ...props, ...extra }));
    return nodes;
  }
  try {
    let nodes = render();
    assert.equal(dynamicOptions.ssr, false, "WebGL is only loaded on the client");
    let viewer = nodes.find(node => node.type === Viewer);
    assert.ok(viewer, "the quick view must default to its inline 3D viewer");
    assert.equal(viewer.props.model, product.model);
    assert.equal(viewer.props.dimensions, product.dimensions);
    assert.equal(viewer.props.color, color.hex);
    assert.equal(viewer.props.material, material.id);
    assert.equal(viewer.props.showStockBadge, false);
    viewer.props.onReady();
    nodes = render();
    assert.ok(JSON.stringify(nodes.find(node => node.props.className === "product-quick-viewer-status")).includes("Чирж эргүүлэх"));
    viewer.props.onError();
    nodes = render();
    assert.ok(nodes.some(node => node.props.className === "product-quick-viewer-status is-error"));
    const failedViewer=nodes.find(node=>node.type===Viewer);
    const retry=nodes.find(node=>node.type==='button' && React.Children.toArray(node.props.children).some(child=>child==='Дахин ачаалах'));
    assert.ok(retry,'an error must offer an actual retry action');retry.props.onClick();nodes=render();
    assert.notEqual(nodes.find(node=>node.type===Viewer).key,failedViewer.key,'retry remounts the failed loader');
    assert.ok(!nodes.some(node=>node.props.className==='product-quick-viewer-status is-error'));
    const modes = nodes.find(node => node.props.className === "product-quick-modes");
    React.Children.toArray(modes.props.children)[1].props.onClick();
    nodes = render();
    assert.ok(!nodes.some(node => node.type === Viewer), "photo mode must unmount the canvas and its assets");
    const photoModes = nodes.find(node => node.props.className === "product-quick-modes");
    React.Children.toArray(photoModes.props.children)[0].props.onClick();
    nodes = render();
    assert.ok(nodes.some(node => node.type === Viewer));
    assert.ok(!nodes.some(node => node.props.className === "product-quick-viewer-status is-error"));
    nodes = render({ product: { ...product, model: undefined } });
    assert.ok(!nodes.some(node => node.type === Viewer), "a photo-only product must never mount an invented model");
    assert.ok(!nodes.some(node => node.props.className === "product-quick-modes"));
  } finally {
    if (previousDocument === undefined) delete global.document;
    else global.document = previousDocument;
  }
});
