import {
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { requireAdmin } from "@/lib/supabase/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const MAX_GLB_SIZE = 200 * 1024 * 1024;

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

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

function parseSourcePath(
  sourcePath: string,
  modelId: string,
  bucket: string,
) {
  const prefix =
    `r2://${bucket}/models/${modelId}/source/`;

  if (!sourcePath.startsWith(prefix)) {
    throw new Error(
      "Source GLB зам буруу байна.",
    );
  }

  const fileName = sourcePath.slice(prefix.length);

  const match =
    /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.glb$/i.exec(
      fileName,
    );

  if (!match) {
    throw new Error(
      "Source GLB файлын нэр буруу байна.",
    );
  }

  return {
    uploadId: match[1],

    key:
      `models/${modelId}/source/${fileName}`,
  };
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

    const bucket =
      process.env.R2_BUCKET_NAME;

    if (!bucket) {
      throw new Error(
        "R2_BUCKET_NAME тохируулаагүй байна.",
      );
    }

    const body = await request.json();

    const modelId =
      typeof body?.modelId === "string"
        ? body.modelId.trim()
        : "";

    const sourcePath =
      typeof body?.sourcePath === "string"
        ? body.sourcePath.trim()
        : "";

    // --------------------------------
    // 1. modelId нь furniture_models.id UUID
    // --------------------------------

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        modelId,
      )
    ) {
      return NextResponse.json(
        {
          error: "3D model ID буруу байна.",
        },
        {
          status: 400,
        },
      );
    }

    // --------------------------------
    // 2. Source R2 path шалгах
    // --------------------------------

    const {
      key,
      uploadId,
    } = parseSourcePath(
      sourcePath,
      modelId,
      bucket,
    );

    // --------------------------------
    // 3. R2 дээр файл үнэхээр байгаа эсэх
    // --------------------------------

    client = getR2Client();

    let head;

    try {
      head = await client.send(
        new HeadObjectCommand({
          Bucket: bucket,
          Key: key,
        }),
      );
    } catch {
      return NextResponse.json(
        {
          error:
            "R2 дээр upload хийсэн GLB олдсонгүй.",
        },
        {
          status: 400,
        },
      );
    }

    const bytes =
      head.ContentLength ?? 0;

    if (
      bytes < 12 ||
      bytes > MAX_GLB_SIZE
    ) {
      return NextResponse.json(
        {
          error:
            "Upload хийсэн GLB-ийн хэмжээ буруу байна.",
        },
        {
          status: 400,
        },
      );
    }

    // --------------------------------
    // 4. Model DB дээр байгаа эсэх
    // --------------------------------

    const db = getSupabaseAdmin();

    const {
      data: model,
      error: modelError,
    } = await db
      .from("furniture_models")
      .select("id")
      .eq("id", modelId)
      .maybeSingle();

    if (modelError) {
      throw modelError;
    }

    if (!model) {
      return NextResponse.json(
        {
          error: "3D model олдсонгүй.",
        },
        {
          status: 404,
        },
      );
    }

    // --------------------------------
    // 5. Worker queue-д оруулах
    // --------------------------------
    //
    // glb_path-ийг одоохондоо өөрчлөхгүй.
    // Worker амжилттай дууссаны дараа
    // шинэ high.glb active болно.
    // --------------------------------

    const now =
      new Date().toISOString();

    const {
      data: queued,
      error: queueError,
    } = await db
      .from("furniture_models")
      .update({
        source_glb_path:
          sourcePath,

        processing_job_id:
          uploadId,

        processing_status:
          "queued",

        processing_error:
          null,

        processing_requested_at:
          now,

        processing_updated_at:
          now,
      })
      .eq("id", modelId)
      .select(
        "id,processing_status,processing_job_id",
      )
      .single();

    if (queueError) {
      throw queueError;
    }

    return NextResponse.json({
      ok: true,

      modelId:
        queued.id,

      jobId:
        queued.processing_job_id,

      status:
        queued.processing_status,
    });
  } catch (error) {
    console.error(
      "[model upload-complete]",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Processing queue-д оруулж чадсангүй.",
      },
      {
        status: 500,
      },
    );
  } finally {
    client?.destroy();
  }
}
