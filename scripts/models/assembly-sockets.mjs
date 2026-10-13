import { readFile } from "node:fs/promises";
import { Matrix4, Quaternion, Vector3 } from "three";

/** Socket transforms must survive Blender export, pruning and quantization. */
export async function readAssemblySockets(file) {
  const bytes = await readFile(file);
  if (bytes.length < 20 || bytes.readUInt32LE(0) !== 0x46546c67) throw new Error("Invalid socket GLB");
  const json = JSON.parse(bytes.toString("utf8", 20, 20 + bytes.readUInt32LE(12)));
  const sockets = new Map();
  const walk = (index, parent) => {
    const node = json.nodes[index];
    const local = node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4().compose(
      new Vector3().fromArray(node.translation ?? [0, 0, 0]),
      new Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]),
      new Vector3().fromArray(node.scale ?? [1, 1, 1]),
    );
    const world = parent.clone().multiply(local);
    if (node.name && node.mesh === undefined && node.camera === undefined && !node.extensions?.KHR_lights_punctual) {
      if (sockets.has(node.name)) throw new Error(`Duplicate assembly socket: ${node.name}`);
      sockets.set(node.name, world.elements);
    }
    for (const child of node.children ?? []) walk(child, world);
  };
  for (const index of json.scenes[json.scene ?? 0].nodes ?? []) walk(index, new Matrix4());
  return sockets;
}

export async function verifyAssemblySockets(source, outputs) {
  const expected = await readAssemblySockets(source);
  for (const output of outputs) {
    const actual = await readAssemblySockets(output);
    for (const [name, matrix] of expected) {
      const next = actual.get(name);
      if (!next || matrix.some((value, i) => Math.abs(value - next[i]) > 1e-5)) {
        throw new Error(`Assembly socket lost or moved: ${name} (${output})`);
      }
    }
  }
}
