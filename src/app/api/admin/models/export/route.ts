import {
  NextRequest,
  NextResponse,
} from "next/server";

import { randomUUID } from "crypto";

import { requireAdmin } from "@/lib/supabase/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic =
  "force-dynamic";

const headers = {
  "Cache-Control":
    "private, no-store",
};

function modelId(
  value: unknown,
) {
  return (
    typeof value ===
      "string" &&
    /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

export async function POST(
  request: NextRequest,
) {
  try {
    const auth =
      await requireAdmin(
        request,
      );

    if (auth.error) {
      return auth.error;
    }

    const body =
      await request
        .json()
        .catch(() => null);

    if (
      !body ||
      !modelId(body.modelId)
    ) {
      return NextResponse.json(
        {
          error:
            "Model ID буруу байна.",
        },
        {
          status: 400,
          headers,
        },
      );
    }

    const { data, error } =
      await getSupabaseAdmin().rpc(
        "request_furniture_model_export",
        {
          p_actor:
            auth.userId,

          p_model:
            body.modelId,
        },
      );

    if (error) {
      throw error;
    }

    return NextResponse.json(
      data,
      { headers },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Standard GLB export эхлүүлж чадсангүй.",
      },
      {
        status: 503,
        headers,
      },
    );
  }
}

export async function GET(
  request: NextRequest,
) {
  try {
    const auth =
      await requireAdmin(
        request,
      );

    if (auth.error) {
      return auth.error;
    }

    const id =
      new URL(
        request.url,
      ).searchParams.get(
        "modelId",
      );

    if (!modelId(id)) {
      return NextResponse.json(
        {
          error:
            "Model ID буруу байна.",
        },
        {
          status: 400,
          headers,
        },
      );
    }

    const {
      data,
      error,
    } =
      await getSupabaseAdmin()
        .from(
          "furniture_models",
        )
        .select(
          "export_status,export_error,standard_glb_path",
        )
        .eq("id", id)
        .maybeSingle();

    if (error) {
      throw error;
    }

    return NextResponse.json(
      {
        status:
          data?.export_status ??
          "idle",

        error:
          data?.export_error ??
          null,

        ready:
          data?.export_status ===
            "ready" &&
          typeof data?.standard_glb_path ===
            "string",
      },
      { headers },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Export төлөвийг уншиж чадсангүй.",
      },
      {
        status: 503,
        headers,
      },
    );
  }
}