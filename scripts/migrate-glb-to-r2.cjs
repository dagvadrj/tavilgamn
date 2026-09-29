const { createHash } = require("node:crypto");

const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");

const { createClient } = require("@supabase/supabase-js");

const MAX = 50 * 1024 * 1024;

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

function sourceKind(row) {
  if (!/^[0-9a-f-]{36}$/i.test(row.id)) {
    throw new Error("Invalid model ID");
  }

  if (/^r2:\/\//.test(row.glb_path)) {
    return "r2";
  }

  if (new RegExp(`^${row.id}/[a-zA-Z0-9._-]+$`).test(row.glb_path)) {
    return "supabase";
  }

  const url = new URL(row.glb_path);

  if (
    url.protocol === "https:" &&
    url.hostname === "res.cloudinary.com" &&
    !url.port &&
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash &&
    url.pathname.startsWith(
      `/${process.env.CLOUDINARY_CLOUD_NAME}/raw/upload/`,
    ) &&
    new RegExp(`/v[0-9]+/casa-nova/models/${row.id}/model[.]glb$`).test(
      url.pathname,
    )
  ) {
    return "cloudinary";
  }

  throw new Error("Unrecognized GLB source");
}

function validate(bytes) {
  if (
    bytes.length < 12 ||
    bytes.length > MAX ||
    bytes.readUInt32LE(0) !== 0x46546c67 ||
    bytes.readUInt32LE(4) !== 2 ||
    bytes.readUInt32LE(8) !== bytes.length
  ) {
    throw new Error("Invalid GLB header or file size exceeds 50 MB");
  }
}

async function readLimited(stream) {
  const chunks = [];
  let size = 0;

  for await (const chunk of stream) {
    size += chunk.length;

    if (size > MAX) {
      throw new Error("File exceeds 50 MB");
    }

    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

async function migrateOne(row, { db, r2, bucket, apply, fetchFile = fetch }) {
  const kind = sourceKind(row);

  if (kind === "r2") {
    return "already-r2";
  }

  if (!apply) {
    return `would-copy-${kind}`;
  }

  let bytes;

  if (kind === "supabase") {
    const { data, error } = await db.storage
      .from("furniture-models")
      .download(row.glb_path);

    if (error) throw error;

    if (data.size > MAX) {
      throw new Error("File exceeds 50 MB");
    }

    bytes = Buffer.from(await data.arrayBuffer());
  } else {
    const response = await fetchFile(row.glb_path, {
      redirect: "error",
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Source download failed: ${response.status}`);
    }

    bytes = await readLimited(response.body);
  }

  validate(bytes);

  const key = `models/${row.id}/model.glb`;

  try {
    await r2.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: bytes,
        ContentType: "model/gltf-binary",
        ContentLength: bytes.length,
        CacheControl: "public, max-age=31536000, immutable",
        IfNoneMatch: "*",
      }),
      {
        abortSignal: AbortSignal.timeout(120000),
      },
    );
  } catch (error) {
    if (error.$metadata?.httpStatusCode !== 412) {
      throw error;
    }

    // Өмнөх оролдлого файл хуулсан ч DB-г шинэчлээгүй байж болно.
  }

  const copied = await r2.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
    {
      abortSignal: AbortSignal.timeout(120000),
    },
  );

  if (!copied.Body || sha(await readLimited(copied.Body)) !== sha(bytes)) {
    throw new Error(
      "R2 verification failed; database reference was not changed",
    );
  }

  const { data, error } = await db.rpc("migrate_model_glb_r2", {
    p_id: row.id,
    p_expected: row.glb_path,
    p_new: `r2://${bucket}/${key}`,
  });

  if (error) throw error;

  if (data !== true) {
    throw new Error("Model changed concurrently; reference was not switched");
  }

  return "migrated";
}

async function main() {
  const apply = process.argv.includes("--apply");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secret) {
    throw new Error("Supabase environment is missing");
  }

  const db = createClient(url, secret, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const bucket = process.env.R2_BUCKET_NAME;
  const account = process.env.R2_ACCOUNT_ID;

  if (
    apply &&
    (!bucket ||
      !account ||
      !process.env.R2_ACCESS_KEY_ID ||
      !process.env.R2_SECRET_ACCESS_KEY)
  ) {
    throw new Error("R2 environment is missing");
  }

  const r2 = apply
    ? new S3Client({
        region: "auto",
        endpoint: `https://${account}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
      })
    : null;

  let after = "";
  let failed = 0;

  console.log(
    apply
      ? "APPLY: copy, verify, then switch database references. Originals are retained."
      : "DRY RUN: no changes.",
  );

  try {
    for (;;) {
      let query = db
        .from("furniture_models")
        .select("id,glb_path")
        .order("id")
        .limit(100);

      if (after) {
        query = query.gt("id", after);
      }

      const { data, error } = await query;

      if (error) throw error;
      if (!data.length) break;

      for (const row of data) {
        try {
          console.log(
            row.id,
            await migrateOne(row, {
              db,
              r2,
              bucket,
              apply,
            }),
          );
        } catch (error) {
          failed++;
          console.error(row.id, error.message);
        }
      }

      after = data[data.length - 1].id;
    }
  } finally {
    r2?.destroy();
  }

  if (failed) {
    process.exitCode = 1;
  }
}

module.exports = {
  migrateOne,
  validate,
  sourceKind,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
