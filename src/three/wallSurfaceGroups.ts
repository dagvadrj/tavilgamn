import type { BufferGeometry } from "three";

/** Paint the broad faces; keep solid section cuts and opening reveals legible.
 * Only the index order changes. Position/normal/UV data and the measured shell
 * stay intact, with at most two draw calls even after several CSG openings.
 */
export function assignWallSurfaceGroups(geometry: BufferGeometry) {
  const normals = geometry.getAttribute("normal");
  const positions = geometry.getAttribute("position");
  const index = geometry.getIndex();
  const painted: number[] = [],
    sections: number[] = [];
  const count = index?.count ?? positions.count;
  for (let offset = 0; offset < count; offset += 3) {
    const triangle = [0, 1, 2].map((i) =>
      index ? index.getX(offset + i) : offset + i,
    );
    const normalZ =
      triangle.reduce((sum, vertex) => sum + normals.getZ(vertex), 0) / 3;
    (Math.abs(normalZ) > 0.99 ? painted : sections).push(...triangle);
  }
  geometry.clearGroups();
  geometry.setIndex([...painted, ...sections]);
  if (painted.length) geometry.addGroup(0, painted.length, 0);
  if (sections.length) geometry.addGroup(painted.length, sections.length, 1);
  return geometry;
}
