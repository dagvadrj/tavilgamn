import "server-only";

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { removeModelFiles } from "@/lib/cloudinaryModels";
export class R2ModelError extends Error {}

function config() {
  const account = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;

  if (
    !account ||
    !/^[a-f0-9]{32}$/i.test(account) ||
    !accessKeyId ||
    !secretAccessKey ||
    !bucket ||
    !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)
  ) {
    throw new R2ModelError("R2 тохиргоо дутуу эсвэл буруу байна.");
  }

  return {
    bucket,
    client: new S3Client({
      region: "auto",
      endpoint: `https://${account}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    }),
  };
}

export function r2ModelKey(
  value: string,
): string | null {
  const match =
    /^r2:\/\/([a-z0-9-]+)\/(models\/[0-9a-f-]{36}\/(?:model(?:-[0-9a-f-]{36})?\.glb|lod\/[0-9a-f-]{36}\/high\.glb))$/i.exec(
      value,
    );

  if (!match) {
    return null;
  }
  const bucket = match[1];
  const key = match[2];
  
  const configuredBucket = process.env.R2_BUCKET_NAME;
  if (configuredBucket && bucket !== configuredBucket) {
    return null;
  }

  return key;
}

export async function uploadR2Glb(
  file: File,
  id: string,
  fileName = "model.glb",
) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    throw new R2ModelError("Загварын ID буруу байна.");
  }

  const { bucket, client } = config();
  if (
  !/^model(?:-[0-9a-f-]{36})?\.glb$/i.test(
    fileName,
  )
) {
  throw new R2ModelError("GLB файлын нэр буруу байна.");
}

const key = `models/${id}/${fileName}`;

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: Buffer.from(await file.arrayBuffer()),
        ContentType: "model/gltf-binary",
        ContentLength: file.size,
        CacheControl: "public, max-age=31536000, immutable",
      }),
      {
        abortSignal: AbortSignal.timeout(120000),
      },
    );

    return `r2://${bucket}/${key}`;
  } catch {
    throw new R2ModelError(
      "GLB файлыг R2 рүү оруулж чадсангүй. Bucket болон API эрхээ шалгана уу.",
    );
  } finally {
    client.destroy();
  }
}

export async function r2DownloadUrl(value: string) {
  const key = r2ModelKey(value);

  if (!key) {
    throw new R2ModelError("R2 файлын зам буруу байна.");
  }

  const publicBase = process.env.R2_PUBLIC_BASE_URL;
  if (publicBase) {
    const url = new URL(publicBase);

    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new R2ModelError("R2 public URL буруу байна.");
    
    return `${url.href.replace(/\/$/, "")}/${key.split("/").map(encodeURIComponent).join("/")}`;
  }

  const { bucket, client } = config();

  try {
    return await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
      {
        expiresIn: 600,
      },
    );
  } finally {
    client.destroy();
  }
}

export async function removeStoredModelFiles(
  db: ReturnType<typeof getSupabaseAdmin>,
  Paths: string[],
) {
  const failures: unknown[] = [];
  const other: string[] = [];

  for (const storedPath of new Set(Paths)) {
    if (!storedPath.startsWith("r2:")) {
      other.push(storedPath);
      continue;
    }

    try {
      const key = r2ModelKey(storedPath);

      if (!key) {
        failures.push(new Error(
       `Invalid R2 model path: ${storedPath}`,
      ),
    );
      continue;}

      const { bucket, client } = config();

      try {
        await client.send(
          new DeleteObjectCommand({
            Bucket: bucket,
            Key: key,
          }),
          {
            abortSignal: AbortSignal.timeout(30000),
          },
        );
      } finally {
        client.destroy();
      }
    } catch (error) {
      failures.push(error);
    }
  }

  try {
    if (other.length) {
      await removeModelFiles(db, other);
    }
  } catch (error) {
    failures.push(error);
  }

  if (failures.length) {
    throw new Error(
      `${failures.length} file cleanup operation(s) failed`,
    );
  }
}
