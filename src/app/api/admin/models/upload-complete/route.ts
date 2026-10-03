import { createHash } from "node:crypto";
import { GetObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api/errors";
import { requireAdmin } from "@/lib/supabase/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { toJson } from "@/lib/supabase/json";
import { GLB_STANDARD, GlbStandardError, inspectGlb, validateCabinetGlb } from "@/lib/glbStandard";

export const runtime = "nodejs";
export const maxDuration = 180;
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request); if (auth.error) return auth.error;
  let client: S3Client | undefined;
  try {
    const body = await request.json();
    const modelId = String(body?.modelId ?? ""), sourcePath = String(body?.sourcePath ?? "");
    const bucket = process.env.R2_BUCKET_NAME;
    if (!bucket || !process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) throw new Error("R2 тохиргоо дутуу.");
    const prefix = `r2://${bucket}/models/${modelId}/source/`;
    if (!/^[0-9a-f-]{36}$/i.test(modelId) || !sourcePath.startsWith(prefix) || !/^[0-9a-f-]{36}\.glb$/i.test(sourcePath.slice(prefix.length))) throw new GlbStandardError("Source GLB зам буруу байна.");
    const db = getSupabaseAdmin();
    const [{ data: model, error: modelError }, { data: intent, error: intentError }] = await Promise.all([
      db.from("furniture_models").select("id,category,dimensions_w,dimensions_h,dimensions_d,archived_at,cabinet_module_id").eq("id", modelId).maybeSingle(),
      db.from("model_assets").select("id,byte_size,state,version_id").eq("model_id", modelId).eq("storage_path", sourcePath).eq("role", "source").eq("created_by", auth.userId).maybeSingle(),
    ]);
    if (modelError) throw modelError; if (intentError) throw intentError;
    if (!model || model.archived_at) return apiErrorResponse({ error: "Идэвхтэй model олдсонгүй." }, { status: 404 });
    if (!intent || !["pending", "available"].includes(intent.state)) throw new GlbStandardError("Upload бүртгэл олдсонгүй.");
    if (intent.state === "available") return NextResponse.json({ ok: true, modelId, jobId: intent.version_id, status: "accepted" });
    if (body.frontConfirmed !== true) throw new GlbStandardError("Upload preview дээр босоо байрлал, +Z нүүрэн талыг батална уу.");
    client = new S3Client({ region: "auto", endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY } });
    const key = sourcePath.slice(`r2://${bucket}/`.length);
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    if (!head.ContentLength || head.ContentLength !== intent.byte_size || head.ContentLength > GLB_STANDARD.maxBytes) throw new GlbStandardError("Upload хэмжээ бүртгэлтэй таарахгүй байна.");
    const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key, IfMatch: head.ETag }), { abortSignal: AbortSignal.timeout(120000) });
    if (!object.Body) throw new GlbStandardError("GLB body байхгүй.");
    const bytes = await object.Body.transformToByteArray();
    const report = inspectGlb(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    const projection = body.frontProjectionMm ?? 0;
    if (typeof projection !== "number" || !Number.isFinite(projection) || projection < 0 || projection > 100 || (projection > 0 && model.category !== "kitchen-cabinet")) throw new GlbStandardError("Бариулын projection буруу байна.");
    report.frontProjectionMm = projection;
    const errors = validateCabinetGlb(report, { widthMm: Number(model.dimensions_w) * 1000, heightMm: Number(model.dimensions_h) * 1000, depthMm: Number(model.dimensions_d) * 1000 });
    if (errors.length) throw new GlbStandardError(errors.join(" "));
    if (model.category === "kitchen-cabinet" && !model.cabinet_module_id) throw new GlbStandardError("Kitchen model-ийн canonical module-ийг эхлээд сонгоно уу.");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const { data: jobId, error } = await db.rpc("queue_model_asset", {
      p_actor: auth.userId, p_model: modelId, p_path: sourcePath, p_sha256: sha256,
      p_validation: toJson({ ...report, frontConfirmed: true, validatedAt: new Date().toISOString() }),
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, modelId, jobId, status: "queued", validation: report });
  } catch (error) {
    console.error("[model upload-complete]", error);
    return apiErrorResponse({ error: error instanceof GlbStandardError ? error.message : "GLB шалгаж queue-д оруулахад алдаа гарлаа." }, { status: error instanceof GlbStandardError ? 400 : 503 });
  } finally { client?.destroy(); }
}
