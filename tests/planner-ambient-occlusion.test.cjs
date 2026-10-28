const test = require("node:test");
const assert = require("node:assert/strict");
const THREE = require("three");
const { loadSource } = require("./helpers/load-source.cjs");
const { occludesView: occludesKitchen } = loadSource("src/three/PlannerAmbientOcclusion.tsx", {
  "three/examples/jsm/postprocessing/GTAOPass.js": { GTAOPass: class {} },
  "three/examples/jsm/postprocessing/EffectComposer.js": {},
  "three/examples/jsm/postprocessing/RenderPass.js": {},
  "three/examples/jsm/postprocessing/OutputPass.js": {},
});

const mesh = (props = {}) => new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial(props));

test("kitchen AO ignores what draws nothing on screen", () => {
  assert.equal(occludesKitchen(mesh()), true, "cabinet panel");
  assert.equal(occludesKitchen(new THREE.Group()), true);
  assert.equal(occludesKitchen(mesh({ visible: false })), false, "pick proxy");
  assert.equal(occludesKitchen(mesh({ colorWrite: false })), false, "shadow-only roof");
  assert.equal(occludesKitchen(mesh({ transparent: true, opacity: 0, depthWrite: false })), false, "cut-away wall");
  assert.equal(occludesKitchen(mesh({ transparent: true, opacity: 0.42 })), false, "contact shadow");
  assert.equal(occludesKitchen(new THREE.LineSegments()), false, "selection edges");
  // drei <Edges> is a LineSegments2: a Mesh whose unit quad only the line shader expands.
  const fatEdges = mesh();
  fatEdges.isLineSegments2 = true;
  assert.equal(occludesKitchen(fatEdges), false, "selected wall's skirting edges");
  const mixed = mesh();
  mixed.material = [new THREE.MeshBasicMaterial({ visible: false }), new THREE.MeshStandardMaterial()];
  assert.equal(occludesKitchen(mixed), true);
});

test("backdrop planes can opt out of ambient occlusion", () => {
  const backdrop = mesh();
  backdrop.userData.noAmbientOcclusion = true;
  assert.equal(occludesKitchen(backdrop), false);
});
