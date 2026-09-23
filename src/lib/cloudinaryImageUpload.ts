import "server-only";
import { createHash } from "node:crypto";

type CloudinaryImage = {
  url: string;
  publicId: string;
  format: string;
  bytes: number;
  width: number;
  height: number;
};

export function cloudinaryImageUploadConfigured() {
  return Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

export async function uploadCloudinaryImage(file: Blob, publicId: string, options: { overwrite?: boolean } = {}): Promise<CloudinaryImage> {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud || !/^[a-zA-Z0-9_-]+$/.test(cloud) || !key || !secret || !/^[a-zA-Z0-9/_-]{1,220}$/.test(publicId)) {
    throw new Error("CLOUDINARY_NOT_CONFIGURED");
  }
  const uploadParams: Record<string, string> = {
    allowed_formats: "jpg,jpeg,png,webp",
    overwrite: String(options.overwrite === true),
    public_id: publicId,
    timestamp: String(Math.floor(Date.now() / 1000)),
  };
  if (options.overwrite) uploadParams.invalidate = "true";
  const signature = createHash("sha256")
    .update(Object.keys(uploadParams).sort().map((name) => `${name}=${uploadParams[name]}`).join("&") + secret)
    .digest("hex");
  const body = new FormData();
  for (const [name, value] of Object.entries(uploadParams)) body.set(name, value);
  body.set("api_key", key);
  body.set("signature", signature);
  body.set("file", file, "image.webp");
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, {
    method: "POST", body, signal: AbortSignal.timeout(60_000),
  });
  const image = await response.json().catch(() => null);
  if (!response.ok || typeof image?.secure_url !== "string" || typeof image?.public_id !== "string"
    || !Number.isInteger(image?.width) || !Number.isInteger(image?.height)) {
    throw new Error("CLOUDINARY_UPLOAD_FAILED");
  }
  const url = new URL(image.secure_url);
  if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com") throw new Error("CLOUDINARY_UPLOAD_FAILED");
  return { url: url.href, publicId: image.public_id, format: String(image.format ?? "webp"),
    bytes: Number(image.bytes) || file.size, width: image.width, height: image.height };
}
