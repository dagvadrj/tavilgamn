const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/load-source.cjs');

test('motion observes iframe and SVG elements directly and stops below the visibility threshold', t => {
  const effects = [], updates = [], cleanups = [];
  const viewport = { ownerDocument: {} }; // An element from a different window.
  const target = { closest: selector => selector === 'svg' ? viewport : null };
  let callback, observed, disconnected = false;
  const oldObserver = globalThis.IntersectionObserver, oldDocument = globalThis.document;
  t.after(() => {
    if (oldObserver) globalThis.IntersectionObserver = oldObserver;
    else delete globalThis.IntersectionObserver;
    if (oldDocument) globalThis.document = oldDocument;
    else delete globalThis.document;
  });
  globalThis.IntersectionObserver = class {
    constructor(cb, options) { callback = cb; assert.equal(options.threshold, .15); }
    observe(element) { observed = element; }
    disconnect() { disconnected = true; }
  };
  globalThis.document = {
    visibilityState: 'visible', addEventListener() {}, removeEventListener() {},
  };
  const { useMotionActivity } = loadSource('src/features/motion/useMotionActivity.ts', {
    react: {
      useRef: () => ({ current: target }),
      useState: initial => [initial, value => updates.push(value)],
      useEffect: effect => effects.push(effect),
      useSyncExternalStore: () => false,
    },
  });
  assert.equal(useMotionActivity().active, false);
  effects.forEach(effect => cleanups.push(effect()));
  assert.equal(observed, viewport);
  updates.length = 0;
  callback([{ isIntersecting: true, intersectionRatio: .2 }]);
  callback([{ isIntersecting: true, intersectionRatio: .1 }]);
  callback([{ isIntersecting: false, intersectionRatio: 0 }]);
  assert.deepEqual(updates, [true, false, false]);
  cleanups.forEach(cleanup => cleanup?.());
  assert.equal(disconnected, true);
});
