const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const THREE = require("three");
const { loadSource } = require("./helpers/load-source.cjs");

test("3D appearance component initializes its real controller and updates the mounted product", () => {
  const slots = [], effects = [];
  let cursor = 0, frame, invalidations = 0;
  const invalidate = () => invalidations++;
  const root = new THREE.Group();
  const surface = new THREE.MeshStandardMaterial({ color: "#ffffff" });
  root.add(new THREE.Mesh(new THREE.BoxGeometry(), surface));
  const ready = [];
  const mockedReact = { ...React,
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useMemo(factory) { const i = cursor++; return slots[i] ??= factory(); },
    useEffect(effect) { effects.push(effect); },
  };
  const { ProductAppearance } = loadSource("src/three/ProductAppearanceGroup.tsx", {
    react: mockedReact,
    "@react-three/fiber": { useThree: selector => selector({ invalidate }), useFrame: callback => { frame = callback; } },
  });
  const tree = ProductAppearance({ children: null, color: "#224466", material: "fabric", onRootReady: value => ready.push(value) });
  tree.props.ref.current = root;
  // Flush the root/controller effect; matchMedia is independent of initialization.
  const cleanup = effects[2]();
  assert.equal(ready[0], root);
  frame({}, 10);
  assert.equal(surface.color.getHexString(), "ffffff", "an idle canvas starts the transition at zero");
  assert.equal(root.userData.appearanceReady, false);
  frame({}, .32);
  assert.equal(surface.color.getHexString(), "224466");
  assert.equal(root.userData.appearanceReady, true);
  assert.ok(surface.normalMap instanceof THREE.DataTexture);
  assert.ok(invalidations > 0);
  let disposed = false;
  surface.normalMap.addEventListener("dispose", () => { disposed = true; });
  cleanup();
  assert.equal(ready[1], null);
  assert.equal(disposed, true);
  root.children[0].geometry.dispose();
  surface.dispose();
});
