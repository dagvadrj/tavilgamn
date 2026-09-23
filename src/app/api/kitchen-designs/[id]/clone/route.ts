import { NextRequest, NextResponse } from "next/server";
import { readKitchenCloneRequest } from "@/lib/kitchenMarketplace";
import {
  kitchenMarketplaceError,
  kitchenPrivateHeaders,
} from "@/lib/kitchenMarketplaceHttp";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/requireUser";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await requireUser(request);
    if (auth.error) return auth.error;

    const input = readKitchenCloneRequest(
      params.id,
      await request.json().catch(() => null),
    );
    const { data, error } = await getSupabaseAdmin().rpc(
      "clone_published_kitchen_design",
      {
        p_actor: auth.userId,
        p_design: input.designId,
        p_project: input.projectId,
      },
    );
    if (error) throw error;

    return NextResponse.json(
      { kitchen: data },
      { status: 201, headers: kitchenPrivateHeaders },
    );
  } catch (error) {
    return kitchenMarketplaceError(
      error,
      "Загварыг өөрийн төсөлд хуулж чадсангүй.",
    );
  }
}
