import { NextRequest, NextResponse } from "next/server";
import { CatalogInputError } from "@/lib/catalogValidation";
import { merchantNotificationFromRow } from "@/lib/merchantNotifications";
import { merchantObject } from "@/lib/merchantValidation";
import { merchantError, merchantHeaders } from "@/lib/merchantServer";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireMerchant } from "@/lib/supabase/requireMerchant";

export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

export async function GET(request: NextRequest) {
  try {
    const auth = await requireMerchant(request);
    if (auth.error) return auth.error;

    const db = getSupabaseAdmin();
    const listQuery = db
      .from("user_notifications")
      .select(
        "id,kind,title,body,href,entity_id,metadata,read_at,created_at",
      )
      .eq("user_id", auth.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    const countQuery = db
      .from("user_notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", auth.userId)
      .is("read_at", null);
    const [listResult, countResult] = await Promise.all([
      listQuery,
      countQuery,
    ]);

    if (listResult.error) throw listResult.error;
    if (countResult.error) throw countResult.error;

    return NextResponse.json(
      {
        notifications: (listResult.data ?? []).map((row) =>
          merchantNotificationFromRow(row as Record<string, unknown>),
        ),
        unreadCount: countResult.count ?? 0,
      },
      { headers: merchantHeaders },
    );
  } catch (error) {
    return merchantError(error, "Мэдэгдлүүдийг ачаалж чадсангүй.");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireMerchant(request);
    if (auth.error) return auth.error;

    const raw = merchantObject(
      await request.json().catch(() => {
        throw new CatalogInputError("JSON буруу байна.");
      }),
    );
    const markAll = raw.all === true;
    const notificationId =
      typeof raw.id === "string" && UUID_PATTERN.test(raw.id) ? raw.id : null;

    if (!markAll && !notificationId) {
      throw new CatalogInputError("Мэдэгдлийн мэдээлэл буруу байна.");
    }

    let query = getSupabaseAdmin()
      .from("user_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", auth.userId)
      .is("read_at", null);

    if (!markAll) query = query.eq("id", notificationId!);

    const { error } = await query;
    if (error) throw error;

    return NextResponse.json({ ok: true }, { headers: merchantHeaders });
  } catch (error) {
    return merchantError(error, "Мэдэгдлийн төлөв хадгалагдсангүй.");
  }
}
