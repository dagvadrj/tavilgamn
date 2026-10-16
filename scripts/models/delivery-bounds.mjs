import { NodeIO, getBounds } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import draco3d from "draco3dgltf";

// Check the delivered, decoded geometry, not the pre-compression Blender report.
export async function decodedDeliveryBounds(file) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    "meshopt.decoder": MeshoptDecoder,
    "draco3d.decoder": await draco3d.createDecoderModule(),
  });
  const document = await io.read(file);
  const scenes = document.getRoot().listScenes();
  if (scenes.length !== 1) throw new Error("Delivery requires exactly one scene");
  const boundsM = getBounds(scenes[0]);
  const dimensions = boundsM.max.map((value, axis) => value - boundsM.min[axis]);
  if (![...boundsM.min, ...boundsM.max].every(Number.isFinite) || dimensions.some(value => value <= 0))
    throw new Error("Invalid decoded delivery bounds");
  return { boundsM, dimensionsM: { w: dimensions[0], h: dimensions[1], d: dimensions[2] } };
}
