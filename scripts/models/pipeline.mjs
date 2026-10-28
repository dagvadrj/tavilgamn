import { parseArgs } from "node:util";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { readGlb } from "./optimize-glb.mjs";
import { sofaSurfaceEligibility } from "./delivery-policy.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const { values } = parseArgs({
  options: {
    input: { type: "string" },
    output: { type: "string" },
    blender: { type: "string" },
    "ktx-bin": { type: "string" },
    "max-triangles": { type: "string", default: "4000000" },
    "geometry-profile": { type: "string", default: "preserve" },
  },
});
if (!values.input || !values.output)
  throw new Error(
    "Use npm run models:pipeline -- --input source-folder --output new-output-folder",
  );
if (!["preserve", "sofa-surface"].includes(values["geometry-profile"]))
  throw new Error("geometry-profile must be preserve or sofa-surface");
const windowsBlender = ["5.2", "5.0"].map(version =>
  `C:/Program Files/Blender Foundation/Blender ${version}/blender.exe`).find(existsSync);
const blender =
  values.blender ??
  process.env.BLENDER_BIN ??
  windowsBlender ?? "blender";
const ktx =
  values["ktx-bin"] ??
  (existsSync(path.join(root, ".tools/ktx/bin/ktx.exe"))
    ? path.join(root, ".tools/ktx/bin")
    : null);
const output = path.resolve(values.output),
  source = path.resolve(values.input);
if (output === source || output.startsWith(source + path.sep))
  throw new Error("Output must be outside source directory");
if (existsSync(output))
  throw new Error(
    "Choose a new output directory; previous results are preserved",
  );
async function run(executable, args) {
  await new Promise((resolve, reject) => {
    const process = spawn(executable, args, {
      stdio: "inherit",
      shell: false,
      windowsHide: true,
      cwd: root,
    });
    process.on("error", reject);
    process.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Pipeline stage failed (${code})`)),
    );
  });
}
try {
  // Evaluate original metadata before Blender normalizes it. Refuse to run a
  // view-sampled sofa cleanup on assemblies, animation or unusual materials.
  const inputs = (await readdir(source)).filter(name => name.toLowerCase().endsWith(".glb"));
  let profile = values["geometry-profile"];
  let preserveReason = null;
  if (profile === "sofa-surface") {
    if (inputs.length !== 1) throw new Error("sofa-surface processes exactly one source per job");
    preserveReason = sofaSurfaceEligibility(readGlb(await readFile(path.join(source, inputs[0]))));
    if (preserveReason) profile = "preserve";
  }
  await run(blender, [
    "--background",
    "--python-exit-code",
    "1",
    "--python",
    path.join(root, "scripts/models/blender_batch.py"),
    "--",
    "--input",
    source,
    "--output",
    path.join(output, "geometry"),
    "--preserve-geometry",
    "--max-triangles",
    values["max-triangles"],
  ]);
  if (profile === "sofa-surface") {
    const name = path.basename(inputs[0], path.extname(inputs[0]));
    await run(blender, ["--background", "--python-exit-code", "1", "--python",
      path.join(root, "scripts/models/sofa-quality-bake.py"), "--",
      "--input", path.join(output, "geometry", name, "delivery.glb"),
      "--output", path.join(output, "compressed", name),
      "--exterior-only", "--keep-authored-surface", "--no-weld-topology",
      "--protect-boundaries", "--samples", "8192",
      // The cap is an input guard, never a visible-surface decimation target.
      "--target-triangles", values["max-triangles"], "--no-generate-preview",
      // Nobody sees renders made inside an unattended job; the decoded read-back still runs.
      "--no-review-renders",
      "--color-size", "2048", "--normal-size", "2048", "--orm-size", "2048",
      "--orm-codec", "etc1s", "--geometry-codec", "meshopt", "--node", process.execPath,
      ...(ktx ? ["--ktx-bin", ktx] : []),
    ]);
  } else await run(process.execPath, [
    path.join(root, "scripts/models/optimize-glb.mjs"),
    "--input",
    path.join(output, "geometry"),
    "--output",
    path.join(output, "compressed"),
    "--max-triangles",
    values["max-triangles"],
    ...(ktx ? ["--ktx-bin", ktx] : []),
  ]);
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, "delivery-profile.json"), JSON.stringify({
    requested: values["geometry-profile"], applied: profile, preserveReason,
    variants: ["delivery"],
  }, null, 2), { flag: "wx" });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
