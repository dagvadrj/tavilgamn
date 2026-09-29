import { readFile, stat } from "node:fs/promises";

import path from "node:path";

import { spawn } from "node:child_process";

import { parseArgs } from "node:util";

import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const CLI = path.join(ROOT, "node_modules/@gltf-transform/cli/bin/cli.js");

function run(executable, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: ROOT,
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

function readGlbJson(buffer) {
  if (
    buffer.length < 20 ||
    buffer.readUInt32LE(0) !== 0x46546c67 ||
    buffer.readUInt32LE(4) !== 2 ||
    buffer.readUInt32LE(8) !== buffer.length
  ) {
    throw new Error("Invalid standard GLB.");
  }

  const length = buffer.readUInt32LE(12);

  if (buffer.readUInt32LE(16) !== 0x4e4f534a || length + 20 > buffer.length) {
    throw new Error("Invalid GLB JSON chunk.");
  }

  return JSON.parse(buffer.toString("utf8", 20, 20 + length));
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
    },
  });

  if (!values.input || !values.output) {
    throw new Error("Use --input web.glb --output standard.glb");
  }

  const input = path.resolve(values.input);

  const output = path.resolve(values.output);

  if (input === output) {
    throw new Error("Input and output must differ.");
  }

  const inputInfo = await stat(input);

  if (!inputInfo.isFile() || inputInfo.size < 20) {
    throw new Error("Input GLB is invalid.");
  }

  const env = {
    ...process.env,
  };

  if (values["ktx-bin"]) {
    const ktxDirectory = path.resolve(values["ktx-bin"]);

    const executable = path.join(
      ktxDirectory,
      process.platform === "win32" ? "ktx.exe" : "ktx",
    );

    await run(executable, ["--version"], env);

    env.PATH = ktxDirectory + path.delimiter + (process.env.PATH ?? "");

    env.CI = "true";
  }

  await run(process.execPath, [CLI, "ktxdecompress", input, output], env);

  const outputBuffer = await readFile(output);

  const json = readGlbJson(outputBuffer);

  const extensions = new Set(json.extensionsUsed ?? []);

  if (
    extensions.has("KHR_draco_mesh_compression") ||
    extensions.has("EXT_meshopt_compression")
  ) {
    throw new Error("Geometry compression remains in standard GLB.");
  }

  if (
    extensions.has("KHR_texture_basisu") ||
    (json.images ?? []).some((image) => image.mimeType === "image/ktx2")
  ) {
    throw new Error("KTX2 texture compression remains in standard GLB.");
  }

  console.log(
    `[standard] ${(inputInfo.size / 1048576).toFixed(2)} MiB -> ${(
      outputBuffer.length / 1048576
    ).toFixed(2)} MiB`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);

  process.exitCode = 1;
});
