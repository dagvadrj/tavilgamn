import {
  NextRequest,
  NextResponse,
} from "next/server";

import { requireAdmin } from "@/lib/supabase/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
) {
  try {
    const auth =
      await requireAdmin(request);

    if (auth.error) {
      return auth.error;
    }

    const { data, error } =
      await getSupabaseAdmin()
        .from("furniture_models")
        .select(
          `
            id,
            processing_status,
            processing_error,
            processing_updated_at,
            export_status,
            export_error,
            standard_glb_path
          `,
        )
        .order(
          "processing_updated_at",
          {
            ascending: false,
            nullsFirst: false,
          },
        );

    if (error) {
      throw error;
    }

    return NextResponse.json(
      {
        models: (data ?? []).map(
          (model) => ({
            id: model.id,

            processingStatus:
              model.processing_status,

            processingError:
              model.processing_error,

            processingUpdatedAt:
              model.processing_updated_at,

            exportStatus:
              model.export_status,

            exportError:
              model.export_error,

            standardReady:
              typeof model.standard_glb_path ===
              "string",
          }),
        ),
      },
      {
        headers: {
          "Cache-Control":
            "private, no-store",
        },
      },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "3D загварын төлөвийг ачаалж чадсангүй.",
      },
      { status: 503 },
    );
  }
}