import {
  NextRequest,
  NextResponse,
} from "next/server";

import { requireAdmin } from "@/lib/supabase/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { r2DownloadUrl } from "@/lib/r2Models";

export const dynamic =
  "force-dynamic";

const headers = {
  "Cache-Control":
    "private, no-store",
};

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

    const params =
      new URL(
        request.url,
      ).searchParams;

    const modelId =
      params.get(
        "modelId",
      );

    const kind =
      params.get("kind");

    if (
      !modelId ||
      !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(
        modelId,
      ) ||
      ![
        "optimized",
        "standard",
      ].includes(
        kind ?? "",
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Download хүсэлт буруу байна.",
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
          "processing_status,high_glb_path,export_status,standard_glb_path",
        )
        .eq(
          "id",
          modelId,
        )
        .maybeSingle();

    if (error) {
      throw error;
    }

    const path =
      kind === "optimized"
        ? data?.high_glb_path
        : data?.standard_glb_path;

    const ready =
      kind === "optimized"
        ? data?.processing_status ===
          "ready"
        : data?.export_status ===
          "ready";

    if (
      !ready ||
      typeof path !== "string"
    ) {
      return NextResponse.json(
        {
          error:
            "Файл хараахан бэлэн болоогүй байна.",
        },
        {
          status: 409,
          headers,
        },
      );
    }

    const url =
      await r2DownloadUrl(
        path,
        `model-${modelId}-${kind}.glb`,
      );

    return NextResponse.json(
      { url },
      { headers },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "GLB татах холбоос үүсгэж чадсангүй.",
      },
      {
        status: 503,
        headers,
      },
    );
  }
}