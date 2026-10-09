const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { loadSource } = require("./helpers/load-source.cjs");

test("product detail keeps the delivery model during camera navigation while preserving its initial progressive load", () => {
  const Canvas = () => null, GLBFurnitureMesh = () => null, MotionPreview = () => null, CursorNavigation = () => null;
  const { ProductViewer } = loadSource("src/three/ProductViewer.tsx", {
    react: { ...React, useRef: value => ({ current: value }) },
    "@react-three/fiber": { Canvas },
    "@react-three/drei": { OrbitControls: () => null, ContactShadows: () => null, Environment: () => null },
    "./GLBFurnitureMesh": { GLBFurnitureMesh },
    "./ProductAppearanceGroup": { ProductAppearance: () => null },
    "./canvasPerformance": { useCanvasPerformance: () => ({ shadows: false, dpr: 1, autoRotate: false }) },
    "./CanvasDiagnostics": { CanvasDiagnostics: () => null },
    "./CameraMotionPreview": { CameraMotionPreview: MotionPreview },
    "./CursorNavigationBinding": { CursorNavigation },
  });
  const tree = ProductViewer({ category: "sofa", color: "#ffffff", material: "fabric", dimensions: { w: 2, d: 1, h: 1 },
    model: { id: "sofa", file: "high.glb", previewFile: "preview.glb" } });
  const all = [];
  function collect(node) {
    if (!React.isValidElement(node)) return;
    all.push(node);
    React.Children.forEach(node.props.children, collect);
  }
  collect(tree);
  assert.equal(all.some(node => node.type === MotionPreview), false, "camera movement must never select the low-quality model on the PDP");
  assert.equal(all.find(node => node.type === GLBFurnitureMesh).props.previewGlbFile, "preview.glb", "the initial lightweight loading stage is still available");
  assert.ok(all.some(node => node.type === CursorNavigation));
  const missing = [];
  function collectMissing(node) {
    if (!React.isValidElement(node)) return;
    missing.push(node);
    React.Children.forEach(node.props.children, collectMissing);
  }
  let ready = 0;
  collectMissing(ProductViewer({ color: "#ffffff", material: "wood", dimensions: { w: .6, d: 1.5, h: 2 }, onReady: () => ready++ }));
  assert.equal(missing.some(node => node.type === Canvas || node.type === GLBFurnitureMesh), false, "a missing GLB must never become a default shelf or a 3D canvas");
  assert.ok(missing.some(node => typeof node.props.children === "string" && node.props.children.includes("3D загвар хараахан бэлэн болоогүй")));
  assert.equal(ready, 0, "an unavailable model must not announce successful loading");
});
