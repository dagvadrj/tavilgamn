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
    "./FurnitureMesh": { FurnitureMesh: () => null },
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
});
