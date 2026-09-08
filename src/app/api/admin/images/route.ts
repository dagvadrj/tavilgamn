import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/requireAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SIZE = 3 * 1024 * 1024;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const headers = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status, headers });

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;

    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    const key = process.env.CLOUDINARY_API_KEY;
    const secret = process.env.CLOUDINARY_API_SECRET;
    if (!cloud || !/^[a-zA-Z0-9_-]+$/.test(cloud) || !key || !secret) {
      return fail("Cloudinary тохиргоо дутуу байна.", 503);
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return fail("Зураг файлаа сонгоно уу.", 400);
    }
    const file = form.get("file");
    if (!(file instanceof File) || !file.size || !TYPES.has(file.type)) {
      return fail("JPG, PNG эсвэл WebP зураг сонгоно уу.", 400);
    }
    if (file.size > MAX_SIZE) {
      return fail("Зураг 3 MB-аас ихгүй байх ёстой.", 413);
    }

    const params: Record<string, string> = {
      allowed_formats: "jpg,png,webp",
      overwrite: "false",
      public_id: `casa-nova/products/${randomUUID()}`,
      timestamp: String(Math.floor(Date.now() / 1000)),
    };
    const signature = createHash("sha256")
      .update(Object.keys(params).sort().map((name) => `${name}=${params[name]}`).join("&") + secret)
      .digest("hex");

    const body = new FormData();
    for (const [name, value] of Object.entries(params)) body.set(name, value);
    body.set("api_key", key);
    body.set("signature", signature);
    body.set("file", file);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(45000),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || typeof data?.secure_url !== "string") {
      return fail("Cloudinary рүү зураг оруулж чадсангүй. Тохиргоо болон зургаа шалгана уу.", 502);
    }
    const url = new URL(data.secure_url);
    if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com") {
      return fail("Зургийн холбоос буруу ирлээ.", 502);
    }
    return NextResponse.json({ url: url.href }, { status: 201, headers });
  } catch {
    return fail("Зураг оруулж чадсангүй. Дахин оролдоно уу.", 503);
  }
}
