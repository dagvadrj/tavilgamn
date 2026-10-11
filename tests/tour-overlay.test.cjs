const { test } = require("node:test");
const assert = require("node:assert/strict");
const THREE = require("three");
const { loadSource } = require("./helpers/load-source.cjs");

test("tour overlay projects on scene frames and defers DOM root teardown past the R3F commit", () => {
  const effects = [],
    frames = [],
    tasks = [];
  const children = { type: "arrow" };
  let attached = 0,
    removed = 0,
    invalidated = 0,
    unmounted = 0,
    rendered;
  const node = {
    style: {},
    remove() {
      removed++;
    },
  };
  const gl = {
    domElement: {
      ownerDocument: { createElement: () => node },
      parentElement: {
        appendChild() {
          attached++;
        },
      },
    },
  };
  const { TourOverlay } = loadSource("src/three/TourOverlay.tsx", {
    react: {
      useRef: (value) => ({ current: value }),
      useEffect: (callback) => effects.push(callback),
    },
    "react-dom/client": {
      createRoot: () => ({
        render: (value) => {
          rendered = value;
        },
        unmount: () => {
          unmounted++;
        },
      }),
    },
    "@react-three/fiber": {
      useThree: () => ({
        gl,
        invalidate() {
          invalidated++;
        },
      }),
      useFrame: (callback) => frames.push(callback),
    },
  });
  const previous = global.queueMicrotask;
  global.queueMicrotask = (callback) => tasks.push(callback);
  try {
    assert.equal(TourOverlay({ position: [0, 0, 0], children }), null);
    const cleanups = effects.map((callback) => callback());
    assert.equal(attached, 1);
    assert.equal(invalidated, 1);
    assert.equal(rendered, children);
    const camera = new THREE.PerspectiveCamera(60, 1, 0.03, 100);
    camera.position.set(0, 1.6, 2);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    frames[0]({ camera, size: { width: 400, height: 400 } });
    assert.equal(node.style.display, "block");
    assert.ok(Math.abs(parseFloat(node.style.left) - 200) < 0.001);
    camera.lookAt(0, 1.6, 4);
    camera.updateMatrixWorld();
    frames[0]({ camera, size: { width: 400, height: 400 } });
    assert.equal(node.style.display, "none");
    cleanups[0]();
    assert.equal(removed, 1);
    assert.equal(unmounted, 0);
    assert.equal(tasks.length, 1);
    tasks[0]();
    assert.equal(unmounted, 1);
  } finally {
    global.queueMicrotask = previous;
  }
});
