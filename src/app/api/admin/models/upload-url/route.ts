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
    await requireAdmin(request);

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

    const fileName =
      typeof body?.fileName === "string"
        ? body.fileName.trim()
        : "";

    const size =
      Number(body?.size);

    // --------------------------------
    // 1. Product ID шалгах
    // --------------------------------

    if (
      !/^[a-zA-Z0-9_-]{1,100}$/.test(
        productId,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Бүтээгдэхүүний ID буруу байна.",
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
      return NextResponse.json(
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
      return NextResponse.json(
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

    const {
      data: model,
      error: modelError,
    } = await db
      .from("furniture_models")
      .select("id,product_id")
      .eq("product_id", productId)
      .maybeSingle();

    if (modelError) {
      throw modelError;
    }

    if (!model) {
      return NextResponse.json(
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

    return NextResponse.json(
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