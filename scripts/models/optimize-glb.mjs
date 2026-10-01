import {
  readFile,
  writeFile,
  mkdir,
  readdir,
  stat,
  mkdtemp,
  rm,
} from "node:fs/promises";

import path from "node:path";
import { spawn } from "node:child_process";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const cli = path.join(root, "node_modules/@gltf-transform/cli/bin/cli.js");

export function readGlb(buffer) {
  if (
    buffer.length < 20 ||
    buffer.readUInt32LE(0) !== 0x46546c67 ||
    buffer.readUInt32LE(4) !== 2 ||
    buffer.readUInt32LE(8) !== buffer.length
  ) {
    throw new Error("Invalid GLB 2.0");
  }

  const length = buffer.readUInt32LE(12);

  if (buffer.readUInt32LE(16) !== 0x4e4f534a || length + 20 > buffer.length) {
    throw new Error("Invalid GLB JSON chunk");
  }

  return JSON.parse(buffer.toString("utf8", 20, 20 + length));
}

export function triangleCount(json) {
  const counts = (json.meshes ?? []).map((mesh) =>
    mesh.primitives.reduce((sum, p) => {
      const count =
        json.accessors[p.indices ?? p.attributes.POSITION]?.count ?? 0;

      return (
        sum +
        ((p.mode ?? 4) === 4
          ? count / 3
          : [5, 6].includes(p.mode)
            ? Math.max(0, count - 2)
            : 0)
      );
    }, 0),
  );

  return (json.nodes ?? []).reduce((sum, node) => {
    if (node.mesh === undefined) {
      return sum;
    }

    const instances = node.extensions?.EXT_mesh_gpu_instancing
      ? json.accessors[
          Object.values(node.extensions.EXT_mesh_gpu_instancing.attributes)[0]
        ].count
      : 1;

    return sum + counts[node.mesh] * instances;
  }, 0);
}

export function atlasAudit(json) {
  // An atlas requires UV repacking
  // and baking each PBR slot
  // separately.
  //
  // Different normal/base-color/ORM
  // maps cannot be combined into one
  // interchangeable image.

  return (json.materials ?? []).map((material, index) => {
    const slots = [];

    function visit(value, key = "") {
      if (!value || typeof value !== "object") {
        return;
      }

      if (key.endsWith("Texture") && Number.isInteger(value.index)) {
        slots.push({
          slot: key,
          ...value,
        });
      } else {
        for (const [k, v] of Object.entries(value)) {
          visit(v, k);
        }
      }
    }

    visit(material);

    const reasons = [];

    if (!slots.length) {
      reasons.push(
        "Solid-color material; a palette may reduce draw calls, no texture atlas needed.",
      );
    }

    if (
      slots.some(
        (slot) =>
          (slot.texCoord ?? 0) !== 0 || slot.extensions?.KHR_texture_transform,
      )
    ) {
      reasons.push("Multiple/transformed UV sets require a bake.");
    }

    if (
      slots.some((slot) => {
        const sampler =
          json.samplers?.[json.textures?.[slot.index]?.sampler] ?? {};

        return (
          (sampler.wrapS ?? 10497) !== 33071 ||
          (sampler.wrapT ?? 10497) !== 33071
        );
      })
    ) {
      reasons.push(
        "Repeating UV samplers need UV-range inspection and gutter-aware baking.",
      );
    }

    if ((material.alphaMode ?? "OPAQUE") !== "OPAQUE" || material.extensions) {
      reasons.push(
        "Transparency/material extensions need separate compatible atlas groups.",
      );
    }

    if (!reasons.length) {
      reasons.push(
        "Candidate for per-slot atlas baking; inspect UV overlap, preserve texel density and add mip gutters.",
      );
    }

    return {
      material: material.name ?? `material-${index}`,

      slots: slots.map((s) => s.slot),

      candidate:
        slots.length > 0 &&
        reasons.length === 1 &&
        reasons[0].startsWith("Candidate"),

      automaticAtlasApplied: false,

      reasons,
    };
  });
}

function run(executable, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      stdio: "inherit",
      shell: false,
      windowsHide: true,
      env,
    });

    child.once("error", reject);

    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${path.basename(executable)} failed (${code})`));
      }
    });
  });
}

async function listInputs(input) {
  if ((await stat(input)).isFile()) {
    return [input];
  }

  const result = [];

  for (const entry of await readdir(input, {
    withFileTypes: true,
  })) {
    const child = path.join(input, entry.name);

    if (entry.isDirectory()) {
      result.push(...(await listInputs(child)));
    } else if (entry.name.toLowerCase().endsWith(".glb")) {
      result.push(child);
    }
  }

  return result.sort();
}

async function main() {
  const { values } = parseArgs({
    options: {
      input: {
        type: "string",
      },

      output: {
        type: "string",
      },

      "ktx-bin": {
        type: "string",
      },

      "texture-size": {
        type: "string",
        default: "2048",
      },

      "max-triangles": {
        type: "string",
        default: "4000000",
      },

      "preview-triangles": {
        type: "string",
        default: "80000",
      },

      "preview-texture-size": {
        type: "string",
        default: "512",
      },

      "preview-only": {
        type: "boolean",
        default: false,
      },
    },
  });

  if (!values.input || !values.output) {
    throw new Error(
      "Use --input geometry-folder --output compressed-folder [--ktx-bin folder]",
    );
  }

  const input = path.resolve(values.input);

  const output = path.resolve(values.output);

  if (output === input || output.startsWith(input + path.sep)) {
    throw new Error("Output must be outside the input tree");
  }

  const size = Number(values["texture-size"]);

  const maxTriangles = Number(values["max-triangles"]);

  const previewTriangles = Number(values["preview-triangles"]);

  const previewTextureSize = Number(values["preview-texture-size"]);

  const previewOnly = values["preview-only"];

  if (![512, 1024, 2048, 4096].includes(size)) {
    throw new Error("texture-size must be 512/1024/2048/4096");
  }

  if (!Number.isInteger(maxTriangles) || maxTriangles < 10000) {
    throw new Error("max-triangles must be an integer >= 10000");
  }

  if (!Number.isInteger(previewTriangles) || previewTriangles < 10000) {
    throw new Error("preview-triangles must be an integer >= 10000");
  }

  if (![256, 512, 1024].includes(previewTextureSize)) {
    throw new Error("preview-texture-size must be 256/512/1024");
  }

  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => key.toLowerCase() !== "path"),
  );

  env.PATH = process.env.PATH;

  if (values["ktx-bin"]) {
    env.PATH =
      path.resolve(values["ktx-bin"]) + path.delimiter + process.env.PATH;
  }

  if (values["ktx-bin"]) {
    const ktxExecutable = path.join(
      path.resolve(values["ktx-bin"]),
      process.platform === "win32" ? "ktx.exe" : "ktx",
    );

    await run(ktxExecutable, ["--version"], env);

    // CLI's optional Windows
    // `where` probe fails in some
    // managed shells.
    //
    // Absolute executable check
    // above replaces that probe.
    env.CI = "true";
  }

  const files = await listInputs(input);

  if (!files.length) {
    throw new Error("No GLBs found");
  }

  const inputRoot = (await stat(input)).isDirectory()
    ? input
    : path.dirname(input);

  const report = [];

  await mkdir(output, {
    recursive: true,
  });

  // --------------------------------
  // Validate geometry stage
  // --------------------------------

  for (const file of files) {
    const json = readGlb(await readFile(file));

    if (
      [...(json.buffers ?? []), ...(json.images ?? [])].some(
        (item) => item.uri && !item.uri.startsWith("data:"),
      )
    ) {
      throw new Error(`${file}: GLB must embed all buffers/textures`);
    }

    const level = path.basename(file, ".glb");

    if (level !== "delivery") {
      throw new Error(`${file}: expected delivery.glb`);
    }
    const triangles = triangleCount(json);
    if (triangles > maxTriangles) {
      throw new Error(
        `${file}: exceeds ${maxTriangles.toLocaleString()} triangles ` +
          `(actual: ${triangles.toLocaleString()})`,
      );
    }
    if (previewOnly) {
      if (!(json.extensionsUsed ?? []).some(extension =>
        ["EXT_meshopt_compression", "KHR_draco_mesh_compression"].includes(extension))) {
        throw new Error(`${file}: preview-only input must be a compressed delivery GLB`);
      }
    } else {
      const validation = JSON.parse(
        await readFile(
          path.join(path.dirname(file), "geometry-report.json"),
          "utf8",
        ),
      );
      if (!validation.delivery?.passed || !validation.preservedGeometry) {
        throw new Error(`${file}: delivery geometry validation has not passed`);
      }
    }
  }

  // --------------------------------
  // Compression
  // --------------------------------

  for (const file of files) {
    const before = await readFile(file);
    const json = readGlb(await readFile(file));
    if (
      [...(json.buffers ?? []), ...(json.images ?? [])].some(
        (item) => item.uri && !item.uri.startsWith("data:"),
      )
    ) {
      throw new Error(`${file}: GLB must embed all buffers/textures`);
    }
    const level = path.basename(file, ".glb");
    if (level !== "delivery") {
      continue;
    }
    const triangles = triangleCount(json);
    if (triangles > maxTriangles) {
      throw new Error(
        `${file}: exceeds ${maxTriangles.toLocaleString()} triangles ` +
          `(actual: ${triangles.toLocaleString()})`,
      );
    }
    if (!previewOnly) {
      const validation = JSON.parse(
        await readFile(
          path.join(path.dirname(file), "geometry-report.json"),
          "utf8",
        ),
      );
      if (!validation.delivery?.passed || !validation.preservedGeometry) {
        throw new Error(`${file}: delivery geometry validation has not passed`);
      }
    }
    const relative = path.relative(inputRoot, path.dirname(file));

    const destination = path.join(output, relative);

    await mkdir(destination, {
      recursive: true,
    });

    for (const variant of previewOnly ? ["preview"] : ["delivery", "preview"]) {
      const result = path.join(destination, `${variant}.glb`);

      try {
        await stat(result);
        throw new Error(`Refusing to overwrite ${result}`);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }

      const work = await mkdtemp(path.join(output, ".encode-"));

      try {
        let stage = file;
        let step = 0;
        const transform = async (command, args = []) => {
          const next = path.join(work, `${++step}.glb`);
          await run(process.execPath, [cli, command, stage, next, ...args], env);
          stage = next;
        };

        await transform("dedup");
        await transform("prune");

        if (variant === "preview" && !json.scenes?.[json.scene ?? 0]?.extras?.pipelineBounds) {
          // Legacy deliveries have no authored bounds. Capture their decoded
          // bounds before simplification so the preview fits exactly like high.
          const [{ NodeIO }, { ALL_EXTENSIONS }, { getBounds }] = await Promise.all([
            import("@gltf-transform/core"),
            import("@gltf-transform/extensions"),
            import("@gltf-transform/functions"),
          ]);
          const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
          const document = await io.read(stage);
          for (const scene of document.getRoot().listScenes()) {
            scene.setExtras({ ...scene.getExtras(), pipelineBounds: getBounds(scene) });
          }
          const next = path.join(work, `${++step}.glb`);
          await io.write(next, document);
          stage = next;
        }

        if (variant === "preview" && triangles > previewTriangles) {
          await transform("weld");
          await transform("simplify", [
            "--ratio",
            String(previewTriangles / triangles),
            "--error",
            "0.02",
            "--lock-border",
            "true",
          ]);
          await transform("prune");
        }

        const texturesAlreadyKtx2 = (json.images ?? []).every(
          (image) => image.mimeType === "image/ktx2",
        );
        if (json.images?.length && !texturesAlreadyKtx2) {
          const textureLimit =
            variant === "preview" ? previewTextureSize : size;
          await transform("resize", [
            "--width",
            String(textureLimit),
            "--height",
            String(textureLimit),
          ]);
          await transform("etc1s", [
            "--quality",
            variant === "preview" ? "128" : "192",
            "--compression",
            variant === "preview" ? "5" : "4",
            "--jobs",
            "4",
          ]);
        }

        await transform("meshopt", [
          "--level",
          "high",
          "--quantize-position",
          "14",
          "--quantize-normal",
          "10",
          "--quantize-texcoord",
          "12",
        ]);

        const final = await readFile(stage);
        const info = readGlb(final);
        const failedTextures = (info.images ?? [])
          .map((image, index) => ({
            index,
            name: image.name ?? null,
            mimeType: image.mimeType ?? null,
          }))
          .filter((image) => image.mimeType !== "image/ktx2");

        if (failedTextures.length) {
          throw new Error(
            `Some textures were not converted to KTX2: ${JSON.stringify(failedTextures)}`,
          );
        }
        if (
          json.images?.length &&
          !(info.extensionsUsed ?? []).includes("KHR_texture_basisu")
        ) {
          throw new Error(
            "KHR_texture_basisu extension is missing after KTX2 compression",
          );
        }
        if (!(info.extensionsUsed ?? []).includes("EXT_meshopt_compression")) {
          throw new Error(
            "EXT_meshopt_compression extension is missing after Meshopt compression",
          );
        }

        await run(process.execPath, [cli, "validate", stage], env);
        await writeFile(result, final, { flag: "wx" });

        const entry = {
          source: path.relative(inputRoot, file),
          file: path.relative(output, result),
          variant,
          beforeBytes: before.length,
          afterBytes: final.length,
          reductionPercent: Number(
            (100 * (1 - final.length / before.length)).toFixed(2),
          ),
          triangles: triangleCount(info),
          targetTriangles: variant === "preview" ? previewTriangles : triangles,
          extensions: info.extensionsUsed,
          atlas: atlasAudit(json),
        };

        if (variant === "preview" && entry.triangles > previewTriangles * 1.1) {
          console.warn(
            `[preview-warning] simplifier retained ${entry.triangles.toLocaleString()} triangles ` +
              `(target ${previewTriangles.toLocaleString()})`,
          );
        }

        report.push(entry);
        await writeFile(
          path.join(output, "compression-report.json"),
          JSON.stringify(report, null, 2),
        );
        console.log(
          `[compressed:${variant}] ${entry.source}: ` +
            `${(before.length / 1048576).toFixed(2)} -> ` +
            `${(final.length / 1048576).toFixed(2)} MiB ` +
            `(${entry.reductionPercent}%) => ${entry.file}`,
        );
      } finally {
        const resolvedWork = path.resolve(work);
        if (
          !resolvedWork.startsWith(output + path.sep) ||
          !path.basename(work).startsWith(".encode-")
        ) {
          throw new Error("Unsafe temporary directory");
        }
        await rm(work, { recursive: true, force: true });
      }
    }
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(error.message);

    process.exitCode = 1;
  });
}
