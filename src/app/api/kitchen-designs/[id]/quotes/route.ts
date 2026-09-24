import { NextRequest, NextResponse } from "next/server";
import { readKitchenQuoteRequest } from "@/lib/kitchenQuotes";
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

    const input = readKitchenQuoteRequest(
      params.id,
      await request.json().catch(() => null),
    );
    const { data, error } = await getSupabaseAdmin().rpc(
      "create_kitchen_quote_request",
      {
        p_actor: auth.userId,
        p_design: input.designId,
        p_project: input.projectId,
        p_idempotency: input.idempotencyKey,
        p_contact: input.contact,
        p_room: input.room,
        p_message: input.message,
      },
    );
    if (error) throw error;

    return NextResponse.json(
      { quote: data },
      { status: 201, headers: kitchenPrivateHeaders },
    );
  } catch (error) {
    return kitchenMarketplaceError(error, "Үнийн хүсэлтийг илгээж чадсангүй.");
  }
}
