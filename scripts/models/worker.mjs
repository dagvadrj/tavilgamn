import { createClient } from "@supabase/supabase-js";

import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

import { mkdir, mkdtemp, rm, stat, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

import { createReadStream, createWriteStream } from "node:fs";

import { pipeline as streamPipeline } from "node:stream/promises";

import { spawn } from "node:child_process";

import { tmpdir } from "node:os";

import path from "node:path";

import { fileURLToPath } from "node:url";
import { previewReference } from "./preview-reference.mjs";

const MAX_SOURCE_SIZE = 200 * 1024 * 1024;

const POLL_INTERVAL = Number(process.env.MODEL_WORKER_POLL_MS ?? 5000);

const MAX_POLL_BACKOFF = 60_000;
const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
// Bounded end-to-end verification: never claim another model's queued job.
const VERIFY_MODEL_ID = process.env.MODEL_WORKER_VERIFY_MODEL_ID;
if (VERIFY_MODEL_ID && !isUuid(VERIFY_MODEL_ID)) throw new Error("Invalid verification model UUID");
function isTransientNetworkError(error) {
  const message = error instanceof Error ? error.message : String(error);

  return /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|UND_ERR|socket/i.test(
    message,
  );
}
function requiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

const SUPABASE_URL = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");

const SUPABASE_KEY = requiredEnv("SUPABASE_SECRET_KEY");

const R2_ACCOUNT_ID = requiredEnv("R2_ACCOUNT_ID");

const R2_ACCESS_KEY_ID = requiredEnv("R2_ACCESS_KEY_ID");

const R2_SECRET_ACCESS_KEY = requiredEnv("R2_SECRET_ACCESS_KEY");

const R2_BUCKET_NAME = requiredEnv("R2_BUCKET_NAME");

const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const r2 = new S3Client({
  region: "auto",

  endpoint: `https://${R2_ACCOUNT_ID}` + `.r2.cloudflarestorage.com`,

  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,

    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function cleanupTemporaryWorkspace(directory) {
  const resolved = path.resolve(directory), tempRoot = path.resolve(tmpdir());
  if (path.dirname(resolved) !== tempRoot || !/^tavilgamn-(?:export-)?[0-9a-f-]{36}-[a-zA-Z0-9]+$/.test(path.basename(resolved))) throw new Error("Unsafe temporary workspace cleanup target");
  await rm(resolved, { recursive: true, force: true });
}

function isUuid(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function sourceKeyFromPath(sourcePath, modelId, jobId) {
  const expected =
    `r2://${R2_BUCKET_NAME}/` + `models/${modelId}/source/` + `${jobId}.glb`;

  if (sourcePath !== expected) {
    throw new Error("Source GLB path does not match model/job.");
  }

  return `models/${modelId}/source/` + `${jobId}.glb`;
}
function deliveryKeyFromPath(deliveryPath, modelId, processingJobId) {
  const expected =
    `r2://${R2_BUCKET_NAME}/` +
    `models/${modelId}/delivery/` +
    `${processingJobId}/model-${processingJobId}.glb`;

  if (deliveryPath !== expected) {
    throw new Error("Delivery GLB path does not match current processing job.");
  }

  return (
    `models/${modelId}/delivery/` +
    `${processingJobId}/model-${processingJobId}.glb`
  );
}

async function run(executable, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: ROOT,
      stdio: "inherit",
      shell: false,
      windowsHide: true,
      env: process.env,
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

async function claimJob() {
  if (VERIFY_MODEL_ID) {
    const { data: pending, error: readError } = await db.from("furniture_models").select("*")
      .eq("id", VERIFY_MODEL_ID).eq("processing_status", "queued").is("archived_at", null).maybeSingle();
    if (readError) throw readError;
    if (!pending) return null;
    const { data: claimed, error: claimError } = await db.from("furniture_models")
      .update({ processing_status: "processing", processing_updated_at: new Date().toISOString() })
      .eq("id", pending.id).eq("processing_job_id", pending.processing_job_id)
      .eq("processing_status", "queued").is("archived_at", null).select("*").maybeSingle();
    if (claimError) throw claimError;
    return claimed;
  }
  const { data, error } = await db.rpc("claim_furniture_model_job");

  if (error) {
    throw new Error(`Could not claim model job: ${error.message}`);
  }

  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  return data[0];
}
async function claimExportJob() {
  const { data, error } = await db.rpc("claim_furniture_model_export_job");

  if (error) {
    throw new Error(`Could not claim export job: ${error.message}`);
  }

  if (!Array.isArray(data) || !data.length) {
    return null;
  }

  return data[0];
}

async function downloadSource(key, destination) {
  const response = await r2.send(
    new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,

      Key: key,
    }),
  );

  const bytes = response.ContentLength ?? 0;

  if (bytes < 12 || bytes > MAX_SOURCE_SIZE) {
    throw new Error(`Invalid source size: ${bytes} bytes`);
  }

  if (!response.Body) {
    throw new Error("R2 source object has no body.");
  }

  await streamPipeline(
    response.Body,
    createWriteStream(destination, {
      flags: "wx",
    }),
  );

  const downloaded = await stat(destination);

  if (downloaded.size !== bytes) {
    throw new Error("Downloaded GLB size does not match R2 object.");
  }

  return downloaded.size;
}

async function uploadGlb(file, key) {
  const info = await stat(file);

  if (!info.isFile() || info.size < 12) {
    throw new Error(`Invalid output GLB: ${file}`);
  }
  const match = /^models\/([0-9a-f-]{36})\/(delivery|standard)\/([0-9a-f-]{36})\//i.exec(key);
  if (!match) throw new Error("Untracked asset key");
  const storagePath = `r2://${R2_BUCKET_NAME}/${key}`;
  const { error: ledgerError } = await db.from("model_assets").upsert({
    model_id: match[1], version_id: match[3], storage_path: storagePath,
    role: match[2] === "standard" ? "standard" : key.includes("/preview-") ? "preview" : "delivery",
    byte_size: info.size, state: "pending",
  }, { onConflict: "storage_path" });
  if (ledgerError) throw ledgerError;

  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,

      Key: key,

      Body: createReadStream(file),

      ContentLength: info.size,

      ContentType: "model/gltf-binary",

      CacheControl: "public, max-age=31536000, immutable",
      IfNoneMatch: "*",
    }),
  );

  return `r2://${R2_BUCKET_NAME}/${key}`;
}

async function deleteR2Key(key, quiet = true) {
  try {
    await r2.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,

        Key: key,
      }),
    );
    const { error } = await db.from("model_assets").update({ state: "deleted", updated_at: new Date().toISOString() }).eq("storage_path", `r2://${R2_BUCKET_NAME}/${key}`);
    if (error) throw error;
  } catch (error) {
    if (!quiet) throw error;
    console.error(`[worker] cleanup failed: ${key}`, error);
  }
}

async function cleanupPublishedSource(modelId, jobId, sourcePath) {
  try {
    const sourceKey = sourceKeyFromPath(sourcePath, modelId, jobId);
    await deleteR2Key(sourceKey, false);
    const { error } = await db
      .from("furniture_models")
      .update({ source_glb_path: null })
      .eq("id", modelId)
      .eq("processing_job_id", jobId)
      .eq("processing_status", "ready")
      .eq("source_glb_path", sourcePath);
    if (error) throw error;
    console.log(`[worker] source deleted: ${modelId}/${jobId}`);
    return true;
  } catch (error) {
    console.error(`[worker] source cleanup will retry: ${modelId}/${jobId}`, error);
    return false;
  }
}

async function cleanupOneReadySource() {
  const { data, error } = await db
    .from("furniture_models")
    .select("id,processing_job_id,source_glb_path,glb_path,preview_glb_path")
    .eq("processing_status", "ready")
    .not("source_glb_path", "is", null)
    .not("preview_glb_path", "is", null)
    .limit(1);
  if (error) throw error;
  const model = data?.[0];
  if (!model) return false;
  if (
    !isUuid(model.id) ||
    !isUuid(model.processing_job_id) ||
    typeof model.source_glb_path !== "string"
  ) {
    throw new Error("Ready model has an invalid source cleanup reference.");
  }
  const { highKey } = previewReference(model, R2_BUCKET_NAME, model.processing_job_id);
  const previewPrefix = `r2://${R2_BUCKET_NAME}/models/${model.id}/delivery/`;
  const previewTail = model.preview_glb_path?.slice(previewPrefix.length);
  const match = typeof previewTail === "string" && previewTail.match(/^([0-9a-f-]{36})\/preview-([0-9a-f-]{36})\.glb$/i);
  if (!model.preview_glb_path?.startsWith(previewPrefix) || !match || match[1] !== match[2] || !isUuid(match[1])) return false;
  for (const key of [highKey, model.preview_glb_path.slice(`r2://${R2_BUCKET_NAME}/`.length)]) {
    const object = await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
    if (!object.ContentLength) throw new Error("Delivery asset is missing or empty; preserving source.");
  }
  return cleanupPublishedSource(
    model.id,
    model.processing_job_id,
    model.source_glb_path,
  );
}

async function processJob(model) {
  const modelId = model.id;

  const jobId = model.processing_job_id;

  if (!isUuid(modelId) || !isUuid(jobId)) {
    throw new Error("Invalid model/job UUID.");
  }

  if (typeof model.source_glb_path !== "string") {
    throw new Error("Model has no source_glb_path.");
  }

  const sourceKey = sourceKeyFromPath(model.source_glb_path, modelId, jobId);

  const workspace = await mkdtemp(path.join(tmpdir(), `tavilgamn-${modelId}-`));

  const sourceDirectory = path.join(workspace, "source");

  const buildDirectory = path.join(workspace, "build");

  const sourceFile = path.join(sourceDirectory, `${modelId}.glb`);

  const uploadedKeys = [];

  let published = false;
  let publishAttempted = false;

  try {
    await mkdir(sourceDirectory, {
      recursive: true,
    });

    console.log(`\n[worker] START ${modelId}`);

    console.log(`[worker] job: ${jobId}`);

    // --------------------------------
    // 1. R2 -> TEMP
    // --------------------------------

    const sourceBytes = await downloadSource(sourceKey, sourceFile);
    const { data: sourceAsset, error: sourceAssetError } = await db.from("model_assets")
      .select("sha256").eq("model_id", modelId).eq("storage_path", model.source_glb_path).maybeSingle();
    if (sourceAssetError) throw sourceAssetError;
    if (sourceAsset?.sha256 && createHash("sha256").update(await readFile(sourceFile)).digest("hex") !== sourceAsset.sha256) throw new Error("Source checksum changed after validation");

    console.log(`[worker] source: ${(sourceBytes / 1048576).toFixed(2)} MiB`);

    // --------------------------------
    // 2. Existing pipeline ажиллуулах
    // --------------------------------

    const pipelineArgs = [
      path.join(ROOT, "scripts/models/pipeline.mjs"),

      `--input=${sourceDirectory}`,

      `--output=${buildDirectory}`,
    ];

    if (process.env.BLENDER_BIN) {
      pipelineArgs.push(`--blender=${process.env.BLENDER_BIN}`);
    }

    if (process.env.KTX_BIN) {
      pipelineArgs.push(`--ktx-bin=${process.env.KTX_BIN}`);
    }

    pipelineArgs.push(
      `--max-triangles=${process.env.MODEL_MAX_TRIANGLES ?? "4000000"}`,
      `--preview-triangles=${process.env.MODEL_PREVIEW_TRIANGLES ?? "80000"}`,
      `--preview-texture-size=${process.env.MODEL_PREVIEW_TEXTURE_SIZE ?? "512"}`,
    );

    await run(process.execPath, pipelineArgs);

    // --------------------------------
    // 3. Final compressed files
    // --------------------------------

    const compressed = path.join(buildDirectory, "compressed", modelId);

    const deliveryFile = path.join(compressed, "delivery.glb");
    const previewFile = path.join(compressed, "preview.glb");
    const deliveryInfo = await stat(deliveryFile);
    const previewInfo = await stat(previewFile);
    if (model.glb_validation) {
      const geometryReport = JSON.parse(await readFile(path.join(buildDirectory, "geometry", modelId, "geometry-report.json"), "utf8"));
      const actual = geometryReport.dimensionsM;
      const projectionM = Number(model.glb_validation.frontProjectionMm ?? 0) / 1000;
      if (!Number.isFinite(projectionM) || projectionM < 0 || projectionM > 0.1 || !actual || ["w", "h", "d"].some(axis => !Number.isFinite(actual[axis]) || Math.abs(actual[axis] - Number(model[`dimensions_${axis}`]) - (axis === "d" ? projectionM : 0)) > 0.005)) throw new Error("Decoded GLB dimensions do not match approved catalog dimensions");
      const bounds = geometryReport.boundsM;
      if (!bounds || ![...bounds.min, ...bounds.max].every(Number.isFinite) || Math.max(Math.abs((bounds.min[0]+bounds.max[0])/2), Math.abs(bounds.min[1]), Math.abs((bounds.min[2]+bounds.max[2])/2)) > 0.002) throw new Error("Decoded GLB origin is not bottom-center");
    }

    if (!deliveryInfo.isFile() || deliveryInfo.size < 12) {
      throw new Error("Missing compressed delivery.glb");
    }
    if (!previewInfo.isFile() || previewInfo.size < 12) {
      throw new Error("Missing compressed preview.glb");
    }

    // --------------------------------
    // 4. TEMP -> R2
    // --------------------------------
    //
    // jobId folder ашиглаж байгаа тул
    // cache-safe immutable build.
    // --------------------------------

    const deliveryKey =
      `models/${modelId}/delivery/` + `${jobId}/model-${jobId}.glb`;
    const deliveryPath = await uploadGlb(deliveryFile, deliveryKey);
    uploadedKeys.push(deliveryKey);
    console.log("[worker] uploaded delivery model.glb");
    const previewKey =
      `models/${modelId}/delivery/` + `${jobId}/preview-${jobId}.glb`;
    const previewPath = await uploadGlb(previewFile, previewKey);
    uploadedKeys.push(previewKey);
    console.log("[worker] uploaded preview GLB");

    // --------------------------------
    // 5. Atomic publish
    // --------------------------------
    //
    // processing_job_id шалгаж байгаа.
    //
    // Энэ хооронд admin шинэ GLB
    // upload хийсэн бол хуучин worker
    // шинэ job-ийг overwrite хийхгүй.
    // --------------------------------

    const now = new Date().toISOString();

    publishAttempted = true;
    const { data: updated, error: updateError } = await db
      .from("furniture_models")
      .update({
        glb_path: deliveryPath,

        preview_glb_path: previewPath,

        standard_glb_path: null,

        export_status: "idle",

        export_error: null,

        export_requested_at: null,

        export_updated_at: null,

        export_job_id: null,

        processing_status: "ready",

        processing_error: null,

        processing_updated_at: now,
      })
      .eq("id", modelId)
      .eq("processing_job_id", jobId)
      .eq("processing_status", "processing")
      .select("id,processing_status");

    if (updateError) {
      throw updateError;
    }

    if (!Array.isArray(updated) || updated.length !== 1) {
      throw new Error("STALE_JOB");
    }

    published = true;

    console.log(`[worker] READY ${modelId}`);
    await cleanupPublishedSource(modelId, jobId, model.source_glb_path);
  } catch (error) {
    const stale = error instanceof Error && error.message === "STALE_JOB";

    // Publish болоогүй шинэ build-ийг
    // R2 дээр үлдээхгүй.
    if (!published && (!publishAttempted || stale)) {
      await Promise.all(uploadedKeys.map((key) => deleteR2Key(key)));
    }
    // A lost publish response may still have committed. Keep immutable assets
    // in that uncertain case rather than deleting a live high/preview pair.

    if (stale) {
      console.log(`[worker] stale job ignored: ${modelId}/${jobId}`);

      return;
    }

    const message = error instanceof Error ? error.message : String(error);

    console.error(`[worker] FAILED ${modelId}`, message);

    // Шинэ job энэ хооронд орж ирсэн бол
    // түүний status-ийг error болгож болохгүй.
    await db
      .from("furniture_models")
      .update({
        processing_status: "error",

        processing_error: message.slice(0, 2000),

        processing_updated_at: new Date().toISOString(),
      })
      .eq("id", modelId)
      .eq("processing_job_id", jobId)
      .eq("processing_status", "processing");

    throw error;
  } finally {
    // --------------------------------
    // 6. БҮХ local temp устгана
    // source + geometry + compressed
    // --------------------------------

    await cleanupTemporaryWorkspace(workspace);

    console.log(`[worker] TEMP deleted: ${workspace}`);
  }
}

async function main() {
  console.log("[worker] furniture model worker started");

  console.log(`[worker] poll interval: ${POLL_INTERVAL} ms`);

  let backoff = POLL_INTERVAL;

  while (true) {
    try {
      const job = await claimJob();

      if (job) {
        backoff = POLL_INTERVAL;

        try {
          await processJob(job);
        } catch (error) {
          // processJob DB status-ээ өөрөө шинэчилнэ.
          if (VERIFY_MODEL_ID) throw error;
        }
        if (VERIFY_MODEL_ID) { r2.destroy(); return; }
        continue;
      }

      if (VERIFY_MODEL_ID) throw new Error("Verification model is not queued; no other jobs were touched");

      const exportJob = await claimExportJob();

      if (exportJob) {
        backoff = POLL_INTERVAL;

        try {
          await processExportJob(exportJob);
        } catch {
          // processExportJob DB status-ээ өөрөө шинэчилнэ.
        }

        continue;
      }

      if (await cleanupOneReadySource()) {
        backoff = POLL_INTERVAL;
        continue;
      }

      backoff = POLL_INTERVAL;

      await sleep(POLL_INTERVAL);
    } catch (error) {
      if (VERIFY_MODEL_ID) throw error;
      if (isTransientNetworkError(error)) {
        console.warn(
          `[worker] Supabase түр холбогдохгүй байна. ` +
            `Retry ${Math.round(backoff / 1000)}s дараа.`,
        );

        await sleep(backoff);

        backoff = Math.min(backoff * 2, MAX_POLL_BACKOFF);

        continue;
      }

      console.error("[worker] loop error", error);

      backoff = POLL_INTERVAL;

      await sleep(POLL_INTERVAL);
    }
  }
}

async function processExportJob(model) {
  const modelId = model.id;

  const exportJobId = model.export_job_id;

  const processingJobId = model.processing_job_id;

  if (!isUuid(modelId) || !isUuid(exportJobId) || !isUuid(processingJobId)) {
    throw new Error("Invalid export job.");
  }

  if (
    model.processing_status !== "ready" ||
    typeof model.glb_path !== "string"
  ) {
    throw new Error("Optimized GLB is not ready.");
  }

  const deliveryKey = deliveryKeyFromPath(
    model.glb_path,
    modelId,
    processingJobId,
  );

  const workspace = await mkdtemp(
    path.join(tmpdir(), `tavilgamn-export-${modelId}-`),
  );

  const inputFile = path.join(workspace, "optimized.glb");

  const outputFile = path.join(workspace, "standard.glb");

  const outputKey =
    `models/${modelId}/standard/` +
    `${processingJobId}/` +
    `${exportJobId}.glb`;

  let uploaded = false;

  try {
    console.log(`\n[worker] EXPORT START ${modelId}`);

    await downloadSource(deliveryKey, inputFile);

    const args = [
      path.join(ROOT, "scripts/models/export-standard-glb.mjs"),

      `--input=${inputFile}`,

      `--output=${outputFile}`,
    ];

    if (process.env.KTX_BIN) {
      args.push(`--ktx-bin=${process.env.KTX_BIN}`);
    }

    await run(process.execPath, args);

    const standardPath = await uploadGlb(outputFile, outputKey);

    uploaded = true;

    const { data: updated, error: updateError } = await db
      .from("furniture_models")
      .update({
        standard_glb_path: standardPath,

        export_status: "ready",

        export_error: null,

        export_updated_at: new Date().toISOString(),
      })
      .eq("id", modelId)
      .eq("processing_job_id", processingJobId)
      .eq("export_job_id", exportJobId)
      .eq("export_status", "processing")
      .select("id,export_status");

    if (updateError) {
      throw updateError;
    }

    if (!Array.isArray(updated) || updated.length !== 1) {
      throw new Error("STALE_EXPORT_JOB");
    }

    console.log(`[worker] EXPORT READY ${modelId}`);
  } catch (error) {
    const stale =
      error instanceof Error && error.message === "STALE_EXPORT_JOB";

    if (uploaded && stale) {
      await deleteR2Key(outputKey);
    }

    if (stale) {
      return;
    }

    const message = error instanceof Error ? error.message : String(error);

    await db
      .from("furniture_models")
      .update({
        export_status: "error",

        export_error: message.slice(0, 2000),

        export_updated_at: new Date().toISOString(),
      })
      .eq("id", modelId)
      .eq("export_job_id", exportJobId)
      .eq("processing_job_id", processingJobId)
      .eq("export_status", "processing");

    throw error;
  } finally {
    await cleanupTemporaryWorkspace(workspace);
  }
}

async function shutdown(signal) {
  console.log(`[worker] ${signal}, shutting down`);

  r2.destroy();

  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));

process.once("SIGTERM", () => void shutdown("SIGTERM"));

main().catch((error) => {
  console.error("[worker] fatal", error);

  r2.destroy();

  process.exitCode = 1;
});
