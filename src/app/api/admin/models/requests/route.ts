import {
  NextRequest,
  NextResponse,
} from "next/server";

import { requireAdmin } from "@/lib/supabase/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-store",
};

export async function GET(
  request: NextRequest,
) {
  try {
    const auth = await requireAdmin(request);

    if (auth.error) {
      auth.error.headers.set(
        "Cache-Control",
        headers["Cache-Control"],
      );

      return auth.error;
    }

    const { data, error } =
      await getSupabaseAdmin().rpc(
        "admin_3d_model_requests",
        {
          p_actor: auth.userId,
        },
      );

    if (error) throw error;

    return NextResponse.json(
      {
        requests: Array.isArray(data)
          ? data
          : [],
      },
      { headers },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "3D model хүсэлтүүдийг ачаалж чадсангүй.",
      },
      {
        status: 503,
        headers,
      },
    );
  }
}