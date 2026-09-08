import "server-only";

import { createHash } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type Kind = "raw" | "image";

export class CloudinaryModelError extends Error {}

function config() {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;

  if (
    !cloud ||
    !/^[a-zA-Z0-9_-]+$/.test(cloud) ||
    !key ||
    !secret
  ) {
    throw new CloudinaryModelError("Cloudinary тохиргоо дутуу байна.");
  }

  return { cloud, key, secret };
}

function signedBody(params: Record<string, string>) {
  const { key, secret } = config();
  const body = new FormData();

  for (const [name, value] of Object.entries(params)) {
    body.set(name, value);
  }

  const signature = createHash("sha256")
    .update(
      Object.keys(params)
        .sort()
        .map((name) => `${name}=${params[name]}`)
        .join("&") + secret,
    )
    .digest("hex");

  body.set("api_key", key);
  body.set("signature", signature);

  return body;
}

export function cloudinaryModelAsset(value: string) {
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/");

    const [
      ,
      cloud,
      kind,
      delivery,
      version,
      app,
      folder,
      id,
      file,
    ] = parts;

    if (
      url.protocol !== "https:" ||
      url.hostname !== "res.cloudinary.com" ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      parts.length !== 9 ||
      cloud !== process.env.CLOUDINARY_CLOUD_NAME ||
      delivery !== "upload" ||
      !/^v\d+$/.test(version) ||
      app !== "casa-nova" ||
      folder !== "models" ||
      !/^[0-9a-f-]{36}$/i.test(id)
    ) {
      return null;
    }

    if (kind === "raw" && file === "model.glb") {
      return {
        kind: "raw" as Kind,
        publicId: `${app}/${folder}/${id}/${file}`,
      };
    }

    if (
      kind === "image" &&
      /^thumbnail\.(jpg|jpeg|png|webp)$/.test(file)
    ) {
      return {
        kind: "image" as Kind,
        publicId: `${app}/${folder}/${id}/thumbnail`,
      };
    }
  } catch {
    // Хуучин Supabase object path URL биш байж болно.
  }

  return null;
}

export async function uploadModelAsset(
  file: File,
  id: string,
  kind: Kind,
) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    throw new Error("Invalid model ID");
  }

  const { cloud } = config();

  const publicId =
    `casa-nova/models/${id}/` +
    (kind === "raw" ? "model.glb" : "thumbnail");

  const body = signedBody({
    public_id: publicId,
    overwrite: "false",
    timestamp: String(Math.floor(Date.now() / 1000)),
    ...(kind === "image"
      ? { allowed_formats: "jpg,png,webp" }
      : {}),
  });

  body.set("file", file);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloud}/${kind}/upload`,
    {
      method: "POST",
      body,
      signal: AbortSignal.timeout(120000),
    },
  );

  const data = await response.json().catch(() => null);

  if (
    !response.ok ||
    typeof data?.secure_url !== "string" ||
    data.public_id !== publicId ||
    cloudinaryModelAsset(data.secure_url)?.kind !== kind ||
    cloudinaryModelAsset(data.secure_url)?.publicId !== publicId
  ) {
    throw new CloudinaryModelError(
      `Cloudinary файл хүлээж авсангүй (HTTP ${response.status}). Тохиргоо болон дансны файлын хэмжээний хязгаарыг шалгана уу.`,
    );
  }

  return data.secure_url as string;
}

export async function removeModelFiles(
  db: ReturnType<typeof getSupabaseAdmin>,
  paths: string[],
) {
  const legacy: string[] = [];
  const failures: unknown[] = [];

  for (const path of paths) {
    try {
      const asset = cloudinaryModelAsset(path);

      if (!asset) {
        if (/^[0-9a-f-]{36}\/[a-zA-Z0-9._-]+$/i.test(path)) {
          legacy.push(path);
        } else {
          throw new Error("Unrecognized model asset");
        }

        continue;
      }

      const { cloud } = config();

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloud}/${asset.kind}/destroy`,
        {
          method: "POST",
          body: signedBody({
            public_id: asset.publicId,
            invalidate: "true",
            timestamp: String(Math.floor(Date.now() / 1000)),
          }),
          signal: AbortSignal.timeout(30000),
        },
      );

      const result = await response.json().catch(() => null);

      if (
        !response.ok ||
        !["ok", "not found"].includes(result?.result)
      ) {
        throw new Error("CDN cleanup failed");
      }
    } catch (error) {
      failures.push(error);
    }
  }

  if (legacy.length) {
    try {
      const { error } = await db.storage
        .from("furniture-models")
        .remove(legacy);

      if (error) throw error;
    } catch (error) {
      failures.push(error);
    }
  }

  if (failures.length) {
    throw new Error(
      `${failures.length} model file cleanup operation(s) failed`,
    );
  }
}