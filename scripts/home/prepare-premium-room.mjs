import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, weld, textureCompress, draco } from "@gltf-transform/functions";
import draco3d from "draco3dgltf";

const out = path.resolve("public/interior/premium");
const work = path.resolve("model-work/premium-room");
await fs.mkdir(out, { recursive: true });
await fs.mkdir(work, { recursive: true });
const sources = [];
async function download(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status}: ${url}`);
  return Buffer.from(await r.arrayBuffer());
}
for (const [id, name] of [
  ["concrete_wall_006", "concrete"],
  ["herringbone_parquet", "parquet"],
  ["wood_table_001", "walnut"],
  ["rough_linen", "linen"],
]) {
  const files = await (
    await fetch(`https://api.polyhaven.com/files/${id}`)
  ).json();
  for (const [slot, key] of [
    ["color", "Diffuse"],
    ["normal", "nor_gl"],
    ["roughness", "Rough"],
  ]) {
    const file = files[key]["1k"].jpg;
    await sharp(await download(file.url))
      .webp({ quality: slot === "normal" ? 95 : 88 })
      .toFile(path.join(out, `${name}-${slot}.webp`));
  }
  sources.push({
    name,
    source: `https://polyhaven.com/a/${id}`,
    license: "CC0-1.0",
  });
}
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "draco3d.encoder": await draco3d.createEncoderModule(),
    "draco3d.decoder": await draco3d.createDecoderModule(),
  });

const id = "mid_century_lounge_chair";
const meta = await (
  await fetch(`https://api.polyhaven.com/files/${id}`)
).json();
const file = meta.gltf["1k"].gltf,
  folder = path.join(work, id);
await fs.mkdir(folder, { recursive: true });
for (const [name, entry] of Object.entries(file.include)) {
  const dest = path.join(folder, name);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, await download(entry.url));
}
const input = path.join(folder, "model.gltf");
await fs.writeFile(input, await download(file.url));
for (const [source, name] of [[input, "lounge-chair"]]) {
  const doc = await io.read(source);
  await doc.transform(dedup(), weld());
  await doc.transform(
    textureCompress({
      encoder: sharp,
      targetFormat: "webp",
      resize: [2048, 2048],
      quality: 88,
    }),
    draco(),
  );
  await io.write(path.join(out, `${name}.glb`), doc);
  sources.push({
    name,
    source: `https://polyhaven.com/a/${id}`,
    license: "CC0-1.0",
  });
}
await sharp(
  "C:/Users/HiTech/.codex/generated_images/01a171b0-38a1-7b62-8695-986083df6900/exec-272fae27-050c-48c6-b232-0f9a954da278.png",
)
  .resize({ width: 1920, withoutEnlargement: true })
  .webp({ quality: 90 })
  .toFile(path.join(out, "living-poster.webp"));
sources.push({
  name: "living-poster",
  source: "User living-room reference, UI removed with image_gen",
  usage: "Loading/error poster only; active room is WebGL",
});
await sharp(
  "C:/Users/HiTech/.codex/generated_images/01a171b0-38a1-7b62-8695-986083df6900/exec-225dfd2c-3a57-4045-a659-65c3db46ccd3.png",
)
  .resize(1024)
  .webp({ quality: 90 })
  .toFile(path.join(out, "linen-color.webp"));
sources.find((v) => v.name === "linen").note =
  "Normal/roughness from rough_linen; color: image_gen neutral ivory upholstery weave";
await sharp(
  "C:/Users/HiTech/.codex/generated_images/01a171b0-38a1-7b62-8695-986083df6900/exec-438dfca8-fbf1-4dff-a0d2-b67b13d6a8d3.png",
)
  .resize(1600)
  .webp({ quality: 88 })
  .toFile(path.join(out, "window-city.webp"));
sources.push({
  name: "window-city",
  source: "image_gen: soft Ulaanbaatar skyline exterior background",
});
await fs.writeFile(
  path.join(out, "sources.json"),
  JSON.stringify(sources, null, 2) + "\n",
);
console.log(
  await Promise.all(
    (await fs.readdir(out)).map(async (name) => ({
      name,
      bytes: (await fs.stat(path.join(out, name))).size,
    })),
  ),
);
