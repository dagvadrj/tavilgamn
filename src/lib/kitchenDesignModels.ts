import "server-only";
import { randomUUID } from "node:crypto";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Logger, NodeIO, getBounds } from "@gltf-transform/core";
import { KHRONOS_EXTENSIONS } from "@gltf-transform/extensions";
import { KitchenMarketplaceInputError } from "./kitchenMarketplace";
import {
  KITCHEN_DESIGN_GLB,
  kitchenGlbDocumentInfo,
  kitchenGlbIssues,
  type KitchenGlbModelInfo,
  type KitchenGlbModelRecord,
} from "./kitchenDesignGlb";
import { r2Config } from "./r2Models";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PATH =
  /^r2:\/\/([a-z0-9-]+)\/(kitchen-designs\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.glb)$/;

const glbKey = (userId: string, uploadId: string) =>
  `kitchen-designs/${userId}/${uploadId}.glb`;
const metaKey = (userId: string, uploadId: string) =>
  `kitchen-designs/${userId}/${uploadId}.json`;

/** Re-reads the browser-prepared GLB; nothing about the model is taken on trust. */
export async function inspectKitchenDesignGlb(
  bytes: Uint8Array,
): Promise<KitchenGlbModelInfo> {
  if (
    bytes.byteLength < 20 ||
    bytes.byteLength > KITCHEN_DESIGN_GLB.maxOutputBytes
  )
    throw new KitchenMarketplaceInputError("GLB файл 40 MB-аас ихгүй байна.");
  const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);
  const document = await io.readBinary(bytes).catch(() => {
    throw new KitchenMarketplaceInputError("GLB файл уншигдсангүй.");
  });
  document.setLogger(new Logger(Logger.Verbosity.ERROR));
  const root = document.getRoot();
  if (root.listScenes().length !== 1 || !root.listMeshes().length)
    throw new KitchenMarketplaceInputError(
      "GLB нэг scene, дор хаяж нэг mesh-тэй байна.",
    );
  const { origin, ...info } = kitchenGlbDocumentInfo(
    document,
    getBounds,
    bytes.byteLength,
  );
  const issues = kitchenGlbIssues(info);
  if (
    Math.max(Math.abs(origin.x), Math.abs(origin.y), Math.abs(origin.z)) >
    KITCHEN_DESIGN_GLB.originToleranceMm
  )
    issues.push(
      "GLB-ийн эх цэг доод төвд байх ёстой. Файлаа дахин сонгоно уу.",
    );
  if (issues.length) throw new KitchenMarketplaceInputError(issues[0]);
  return info;
}

/** Private upload, owned by one merchant until a design version references it. */
export async function storeKitchenDesignGlb(userId: string, file: File) {
  if (!UUID.test(userId))
    throw new KitchenMarketplaceInputError("Хэрэглэгч буруу байна.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const info = await inspectKitchenDesignGlb(bytes);
  const uploadId = randomUUID();
  const { bucket, client } = r2Config();
  const record: KitchenGlbModelRecord = {
    path: `r2://${bucket}/${glbKey(userId, uploadId)}`,
    uploadId,
    originalName: file.name.slice(0, 160),
    widthMm: info.widthMm,
    depthMm: info.depthMm,
    heightMm: info.heightMm,
    bytes: info.bytes,
    meshes: info.meshes,
    triangles: info.triangles,
  };
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: glbKey(userId, uploadId),
        Body: bytes,
        ContentType: "model/gltf-binary",
        ContentLength: bytes.byteLength,
        CacheControl: "private, max-age=31536000, immutable",
      }),
      { abortSignal: AbortSignal.timeout(120_000) },
    );
    const meta = JSON.stringify(record);
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: metaKey(userId, uploadId),
        Body: meta,
        ContentType: "application/json",
      }),
      { abortSignal: AbortSignal.timeout(30_000) },
    );
  } finally {
    client.destroy();
  }
  return { record, info };
}

/** The server-side record of an upload; the browser only ever sends its id. */
export async function readKitchenDesignUpload(
  userId: string,
  uploadId: unknown,
) {
  if (
    typeof uploadId !== "string" ||
    !UUID.test(uploadId) ||
    !UUID.test(userId)
  )
    throw new KitchenMarketplaceInputError("GLB файлаа дахин оруулна уу.");
  const { bucket, client } = r2Config();
  try {
    const response = await client
      .send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: metaKey(userId, uploadId),
        }),
        {
          abortSignal: AbortSignal.timeout(30_000),
        },
      )
      .catch(() => null);
    const value = response?.Body
      ? JSON.parse(await response.Body.transformToString())
      : null;
    if (
      !value ||
      value.uploadId !== uploadId ||
      value.path !== `r2://${bucket}/${glbKey(userId, uploadId)}`
    )
      throw new KitchenMarketplaceInputError(
        "GLB файл олдсонгүй. Дахин оруулна уу.",
      );
    return value as KitchenGlbModelRecord;
  } finally {
    client.destroy();
  }
}

export function kitchenGlbModelPath(model: unknown) {
  const path =
    model && typeof model === "object"
      ? (model as { path?: unknown }).path
      : null;
  if (typeof path !== "string") return null;
  const match = PATH.exec(path);
  const bucket = process.env.R2_BUCKET_NAME;
  return match && (!bucket || match[1] === bucket) ? match[2] : null;
}

/** Same-origin stream so three.js / model-viewer never need R2 CORS. */
export async function kitchenGlbModelResponse(
  key: string,
  cacheControl: string,
) {
  const { bucket, client } = r2Config();
  let url: string;
  try {
    url = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: 300 },
    );
  } finally {
    client.destroy();
  }
  const upstream = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(120_000),
  });
  if (!upstream.ok || !upstream.body)
    throw new Error(`R2 kitchen model fetch failed (${upstream.status})`);
  const headers = new Headers({
    "Cache-Control": cacheControl,
    "Content-Type": "model/gltf-binary",
    "X-Content-Type-Options": "nosniff",
  });
  for (const name of ["content-length", "etag", "last-modified"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(upstream.body, { status: 200, headers });
}
