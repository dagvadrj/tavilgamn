import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { buildPcmallAppliance } from "./pcmall-appliance-geometry.mjs";
const source = await fs.readFile("src/lib/pcmallAppliances.ts", "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const catalog = {};
new Function("exports", compiled)(catalog);
const directory = path.resolve("public/models/pcmall");
const modelDirectory = path.join(directory, catalog.PCMALL_MODEL_VERSION);
await fs.mkdir(modelDirectory, { recursive: true });
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(value => { this.result = value; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then(value => { this.result = `data:${blob.type};base64,${Buffer.from(value).toString("base64")}`; this.onloadend?.(); }); }
};
if (process.argv.includes("--download-images")) {
  await Promise.all(catalog.PCMALL_APPLIANCES.map(async item => {
    const response = await fetch(item.imageUrl);
    if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) throw new Error(`Image failed: ${item.model}`);
    await fs.writeFile(path.join(directory, item.imageFile), Buffer.from(await response.arrayBuffer()));
  }));
}
const report = [];
for (const item of catalog.PCMALL_APPLIANCES) {
  const root = buildPcmallAppliance(item, catalog.pcmallSourceUrl(item));
  const glb = await new GLTFExporter().parseAsync(root, { binary: true, onlyVisible: true });
  await fs.writeFile(path.join(modelDirectory, `${item.type}.glb`), Buffer.from(glb));
  let triangles = 0;
  root.traverse(mesh => { if (mesh.isMesh) triangles += (mesh.geometry.index?.count ?? mesh.geometry.getAttribute("position").count) / 3; });
  const entry = { type: item.type, bytes: glb.byteLength, meshes: root.children.length, triangles, dimensionsMm: [item.width, item.depth, item.height], features: root.userData.qualityFeatures };
  report.push(entry); console.log(JSON.stringify(entry));
  const materials = new Set();
  root.traverse(mesh => { if (mesh.isMesh) { mesh.geometry.dispose(); materials.add(mesh.material); } });
  materials.forEach(material => material.dispose());
}
await fs.writeFile(path.join(modelDirectory, "quality-report.json"), JSON.stringify(report, null, 2) + "\n");
await fs.writeFile(path.join(directory, "catalog.json"), JSON.stringify(catalog.PCMALL_APPLIANCES, null, 2) + "\n");
