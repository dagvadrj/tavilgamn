const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { loadSource } = require("./helpers/load-source.cjs");

function harness(total, fallback = false) {
  const original = { observer: global.IntersectionObserver, window: global.window };
  const observers = [], actions = [], listeners = new Map(), slots = [];
  let cursor = 0, effects = [], tree, pending = false, top = 2000;
  global.window = {
    innerHeight: 800,
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name) { listeners.delete(name); },
  };
  global.IntersectionObserver = fallback ? undefined : class {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(element) { this.element = element; }
    disconnect() { this.disconnected = true; }
  };
  const startTransition = action => { pending = true; actions.push(action); };
  const { HomeRecommendations } = loadSource("src/components/HomeRecommendations.tsx", {
    react: { ...React,
      useState(initial) {
        const slot = slots[cursor++] ??= { value: initial };
        return [slot.value, next => { slot.value = typeof next === "function" ? next(slot.value) : next; }];
      },
      useRef(initial) { return slots[cursor++] ??= { current: initial }; },
      useTransition: () => [pending, startTransition],
      useEffect(callback, deps) {
        const index = cursor++, previous = slots[index];
        if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i])))
          effects.push(() => {
            previous?.cleanup?.();
            slots[index] = { deps, cleanup: callback() };
          });
      },
    },
    "./ProductCard": { ProductCard: () => null },
  });
  const props = { products: Array.from({ length: total }, (_, id) => ({ id: String(id) })), initialCount: 10, offerCheckedAt: 123 };
  const render = () => {
    cursor = 0; effects = [];
    tree = HomeRecommendations(props);
    const sentinel = React.Children.toArray(tree.props.children)[1];
    if (sentinel) sentinel.props.ref.current = { getBoundingClientRect: () => ({ top, bottom: top + 44 }) };
    effects.forEach(effect => effect());
  };
  render();
  return {
    observers, actions, listeners,
    count: () => React.Children.count(React.Children.toArray(tree.props.children)[0].props.children),
    ids: () => React.Children.toArray(React.Children.toArray(tree.props.children)[0].props.children).map(card => card.props.product.id),
    hasLoader: () => React.Children.toArray(tree.props.children).length > 1,
    busy: () => React.Children.toArray(tree.props.children)[0].props["aria-busy"],
    intersect(value = true, observer = observers.at(-1)) { observer.callback([{ isIntersecting: value }]); render(); },
    scroll(position) { top = position; listeners.get("scroll")?.(); render(); },
    complete() { actions.splice(0).forEach(action => action()); pending = false; render(); },
    cleanup() {
      slots.forEach(slot => slot?.cleanup?.());
      global.IntersectionObserver = original.observer; global.window = original.window;
    },
  };
}

test("scrolling appends ten products once per batch, preserves previous cards and stops at the actual total", () => {
  const h = harness(29);
  try {
    assert.equal(h.count(), 10);
    assert.equal(h.actions.length, 0);
    const first = h.ids(), firstObserver = h.observers[0];
    h.intersect(false); assert.equal(h.actions.length, 0);
    h.intersect(); h.intersect();
    assert.equal(h.actions.length, 1, "repeated notifications cannot skip a batch");
    assert.equal(h.busy(), true);
    h.complete();
    assert.equal(h.count(), 20);
    assert.deepEqual(h.ids().slice(0, 10), first);
    assert.equal(firstObserver.disconnected, true);
    h.intersect(true, firstObserver);
    assert.equal(h.actions.length, 0, "stale observers cannot load after disconnect");
    h.intersect(); h.complete();
    assert.equal(h.count(), 29);
    assert.equal(h.hasLoader(), false);
    assert.equal(h.observers.at(-1).disconnected, true);
  } finally { h.cleanup(); }
});

test("a short complete catalog does not start a scroll observer", () => {
  const h = harness(3);
  try {
    assert.equal(h.count(), 3);
    assert.equal(h.hasLoader(), false);
    assert.equal(h.observers.length, 0);
  } finally { h.cleanup(); }
});

test("browsers without IntersectionObserver append on scroll and clean up listeners", () => {
  const h = harness(19, true);
  try {
    h.scroll(1500); assert.equal(h.actions.length, 0);
    h.scroll(950); h.scroll(900);
    assert.equal(h.actions.length, 1);
    h.complete();
    assert.equal(h.count(), 19);
    assert.equal(h.listeners.size, 0);
    assert.equal(h.hasLoader(), false);
  } finally { h.cleanup(); }
});
