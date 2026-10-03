import { apiErrorResponse } from "@/lib/api/errors";
import { randomUUID } from "node:crypto";

import {
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { requireAdmin } from "@/lib/supabase/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { enforceApiRateLimit } from "@/lib/rateLimit";

const MAX_GLB_SIZE =
  200 * 1024 * 1024;

function getR2Client() {
  const accountId =
    process.env.R2_ACCOUNT_ID;

  const accessKeyId =
    process.env.R2_ACCESS_KEY_ID;

  const secretAccessKey =
    process.env.R2_SECRET_ACCESS_KEY;

  if (
    !accountId ||
    !accessKeyId ||
    !secretAccessKey
  ) {
    throw new Error(
      "R2 environment тохиргоо дутуу байна.",
    );
  }

  return new S3Client({
    region: "auto",

    endpoint:
      `https://${accountId}.r2.cloudflarestorage.com`,

    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

export async function POST(
  request: NextRequest,
) {
  let client: S3Client | null = null;

  try {
    const auth = await requireAdmin(request);

    if (auth.error) {
      return auth.error;
    }
    const rateLimitResponse = await enforceApiRateLimit(request, auth.userId);
    if (rateLimitResponse) return rateLimitResponse;

    const bucket =
      process.env.R2_BUCKET_NAME;

    if (!bucket) {
      throw new Error(
        "R2_BUCKET_NAME тохируулаагүй байна.",
      );
    }

    const body =
      await request.json();

    const productId =
      typeof body?.productId === "string"
        ? body.productId.trim()
        : "";

    const requestedModelId =
      typeof body?.modelId === "string"
        ? body.modelId.trim()
        : "";

    const fileName =
      typeof body?.fileName === "string"
        ? body.fileName.trim()
        : "";

    const size =
      Number(body?.size);

    // --------------------------------
    // 1. Model UUID эсвэл legacy product ID шалгах
    // --------------------------------

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestedModelId) &&
      !/^[a-zA-Z0-9_-]{1,100}$/.test(productId)
    ) {
      return apiErrorResponse(
        {
          error:
            "3D model эсвэл бүтээгдэхүүний ID буруу байна.",
        },
        {
          status: 400,
        },
      );
    }

    // --------------------------------
    // 2. GLB validation
    // --------------------------------

    if (
      !fileName
        .toLowerCase()
        .endsWith(".glb")
    ) {
      return apiErrorResponse(
        {
          error:
            "Зөвхөн GLB файл оруулна.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !Number.isSafeInteger(size) ||
      size < 12 ||
      size > MAX_GLB_SIZE
    ) {
      return apiErrorResponse(
        {
          error:
            "GLB файл 200 MB-аас ихгүй байна.",
        },
        {
          status: 400,
        },
      );
    }

    // --------------------------------
    // 3. productId -> model UUID
    // --------------------------------

    const db =
      getSupabaseAdmin();

    const lookup = db
      .from("furniture_models")
      .select("id,product_id,category,dimensions_w,dimensions_h,dimensions_d,archived_at,cabinet_module_id");

    const {
      data: model,
      error: modelError,
    } = requestedModelId
      ? await lookup.eq("id", requestedModelId).maybeSingle()
      : await lookup.eq("product_id", productId).maybeSingle();

    if (modelError) {
      throw modelError;
    }

    if (!model) {
      return apiErrorResponse(
        {
          error:
            "Энэ бүтээгдэхүүнд 3D model олдсонгүй.",
        },
        {
          status: 404,
        },
      );
    }

    const modelId =
      model.id;
    if (model.archived_at) return apiErrorResponse({ error: "Архивласан model-д upload хийхгүй." }, { status: 409 });
    if (model.category === "kitchen-cabinet" && !model.cabinet_module_id) {
      const moduleId = typeof body.moduleId === "string" ? body.moduleId : "";
      if (!/^[0-9a-f-]{36}$/i.test(moduleId)) return apiErrorResponse({ error: "Kitchen module сонгоно уу." }, { status: 400 });
      const { data: module, error } = await db.from("kitchen_modules").select("id,width_mm,height_mm,depth_mm").eq("id", moduleId).eq("active", true).maybeSingle();
      if (error) throw error;
      if (!module || Math.abs(Number(model.dimensions_w) * 1000 - module.width_mm) > 5 || Math.abs(Number(model.dimensions_h) * 1000 - module.height_mm) > 5 || Math.abs(Number(model.dimensions_d) * 1000 - module.depth_mm) > 5) return apiErrorResponse({ error: "Kitchen model-ийн хэмжээ module-тэй таарахгүй." }, { status: 400 });
      const { data: linked, error: linkError } = await db.from("furniture_models").update({ cabinet_module_id: moduleId }).eq("id", model.id).is("archived_at", null).is("cabinet_module_id", null).select("id").maybeSingle();
      if (linkError) throw linkError;
      if (!linked) return apiErrorResponse({ error: "Model өөрчлөгдсөн байна. Дахин ачаална уу." }, { status: 409 });
    }

    // --------------------------------
    // 4. Unique source key
    // --------------------------------

    const uploadId =
      randomUUID();

    const key =
      `models/${modelId}/source/` +
      `${uploadId}.glb`;

    client =
      getR2Client();

    const command =
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,

        ContentType:
          "model/gltf-binary",

        CacheControl:
          "private, no-cache",
      });

    const uploadUrl =
      await getSignedUrl(
        client,
        command,
        {
          expiresIn: 15 * 60,
        },
      );

    // Register intent BEFORE exposing PUT URL: abandoned uploads stay tracked.
    const { error: intentError } = await db.from("model_assets").insert({
      model_id: modelId, version_id: uploadId, role: "source",
      storage_path: `r2://${bucket}/${key}`, original_name: fileName.slice(0, 255),
      byte_size: size, created_by: auth.userId, state: "pending",
    });
    if (intentError) throw intentError;
    return NextResponse.json({
      uploadUrl,

      modelId,

      uploadId,

      sourcePath:
        `r2://${bucket}/${key}`,

      key,

      expiresIn:
        15 * 60,
    });
  } catch (error) {
    console.error(
      "[model upload-url]",
      error,
    );

    return apiErrorResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Upload URL үүсгэж чадсангүй.",
      },
      {
        status: 500,
      },
    );
  } finally {
    client?.destroy();
  }
}
