import { createClient } from "@supabase/supabase-js";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { parseArgs } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { previewReference } from "./preview-reference.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { values } = parseArgs({
  options: {
    limit: { type: "string", default: "100" },
    "dry-run": { type: "boolean", default: false },
  },
});
const limit = Number(values.limit);
if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
  throw new Error("--limit must be an integer from 1 to 500");
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

const bucket = required("R2_BUCKET_NAME");
const db = createClient(
  required("NEXT_PUBLIC_SUPABASE_URL"),
  required("SUPABASE_SECRET_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${required("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: required("R2_ACCESS_KEY_ID"),
    secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
  },
});

function run(executable, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: ROOT,
      stdio: "inherit",
      shell: false,
      windowsHide: true,
      env: process.env,
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${path.basename(executable)} failed (${code})`)),
    );
  });
}

async function build(model) {
  const { highKey, previewKey } = previewReference(model, bucket, randomUUID());
  const workspace = await mkdtemp(path.join(tmpdir(), `tavilga-preview-${model.id}-`));
  const highFile = path.join(workspace, "delivery.glb");
  const output = path.join(workspace, "output");
  let uploaded = false;
  let publishAttempted = false;
  const previewPath = `r2://${bucket}/${previewKey}`;

  try {
    const object = await r2.send(
      new GetObjectCommand({ Bucket: bucket, Key: highKey }),
    );
    if (!object.Body) throw new Error("Delivery GLB has no body");
    await pipeline(object.Body, createWriteStream(highFile, { flags: "wx" }));

    const args = [
      path.join(ROOT, "scripts/models/optimize-glb.mjs"),
      `--input=${highFile}`,
      `--output=${output}`,
      "--preview-only",
      `--preview-triangles=${process.env.MODEL_PREVIEW_TRIANGLES ?? "80000"}`,
      `--preview-texture-size=${process.env.MODEL_PREVIEW_TEXTURE_SIZE ?? "512"}`,
    ];
    if (process.env.KTX_BIN) args.push(`--ktx-bin=${process.env.KTX_BIN}`);
    await run(process.execPath, args);

    const previewFile = path.join(output, "preview.glb");
    const info = await stat(previewFile);
    await r2.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: previewKey,
        Body: createReadStream(previewFile),
        ContentLength: info.size,
        ContentType: "model/gltf-binary",
        CacheControl: "public, max-age=31536000, immutable",
        IfNoneMatch: "*",
      }),
    );
    uploaded = true;

    publishAttempted = true;
    const { data, error } = await db
      .from("furniture_models")
      .update({ low_glb_path: previewPath })
      .eq("id", model.id)
      .eq("processing_job_id", model.processing_job_id)
      .eq("processing_status", "ready")
      .eq("glb_path", model.glb_path)
      .is("low_glb_path", null)
      .select("id,low_glb_path");
    if (error) throw error;
    if (!Array.isArray(data) || data.length !== 1) throw new Error("STALE_MODEL");

    console.log(
      `[preview-backfill] ${model.name}: ${(info.size / 1048576).toFixed(2)} MiB`,
    );
  } catch (error) {
    // A lost response can still mean the publish committed. Never remove a
    // possibly referenced object; only delete after confirming it is unused.
    let unused = !publishAttempted;
    if (uploaded && publishAttempted) {
      const check = await db.from("furniture_models")
        .select("id").eq("low_glb_path", previewPath).limit(1);
      unused = !check.error && Array.isArray(check.data) && check.data.length === 0;
    }
    if (uploaded && unused) {
      await r2.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: previewKey }),
      );
    }
    throw error;
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

try {
  const { data, error } = await db
    .from("furniture_models")
    .select("id,name,glb_path,low_glb_path,processing_job_id,processing_status")
    .eq("processing_status", "ready")
    .is("low_glb_path", null)
    .order("processing_updated_at", { ascending: true })
    .limit(limit);
  if (error) throw error;

  let completed = 0;
  if (values["dry-run"]) {
    for (const model of data ?? []) {
      previewReference(model, bucket, randomUUID());
      console.log(`[preview-backfill] pending ${model.id} ${model.name}`);
    }
  } else {
    let failures = 0;
    for (const model of data ?? []) {
      try { await build(model); completed++; }
      catch (error) {
        failures++;
        console.error(`[preview-backfill] ${model.id} ${model.name}: ${error.message}`);
      }
    }
    if (failures) {
      console.error(`[preview-backfill] ${failures} model(s) still need attention`);
      process.exitCode = 1;
    }
  }
  console.log(values["dry-run"]
    ? `[preview-backfill] ${data?.length ?? 0} pending model(s)`
    : `[preview-backfill] completed ${completed} model(s)`);
} finally {
  r2.destroy();
}
