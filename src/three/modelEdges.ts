import {
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  type Object3D,
} from "three";

/**
 * GLB keeps faces, not SketchUp's drawn edges, so cabinet boards lose their
 * outlines on the web. Rebuild them from the geometry: only creases sharper
 * than the threshold become lines, so flat panels stay clean.
 */
export function addModelEdges(root: Object3D, thresholdAngle = 30) {
  const material = new LineBasicMaterial({
    color: 0x2a2926,
    transparent: true,
    opacity: 0.6,
  });
  const lines: LineSegments[] = [];
  const meshes: Mesh[] = [];
  root.traverse((object) => {
    if (object instanceof Mesh) meshes.push(object);
  });
  for (const mesh of meshes) {
    const edges = new LineSegments(
      new EdgesGeometry(mesh.geometry, thresholdAngle),
      material,
    );
    edges.name = "kg-edges";
    // Outlines are decoration: clicks and hover always resolve to the board.
    edges.raycast = () => {};
    mesh.add(edges);
    lines.push(edges);
  }
  return {
    setVisible(visible: boolean) {
      for (const line of lines) line.visible = visible;
    },
    dispose() {
      for (const line of lines) {
        line.removeFromParent();
        line.geometry.dispose();
      }
      material.dispose();
    },
  };
}
