import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/requireAdmin";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);

    if (auth.error) {
      auth.error.headers.set("Cache-Control", headers["Cache-Control"]);
      return auth.error;
    }

    const rawPage = new URL(request.url).searchParams.get("page") ?? "1";

    if (!/^[1-9]\d{0,5}$/.test(rawPage)) {
      return NextResponse.json(
        { error: "Хуудасны дугаар буруу байна." },
        { status: 400, headers },
      );
    }

    const page = Number(rawPage);
    const db = getSupabaseAdmin();

    const { data, error } = await db.auth.admin.listUsers({
      page,
      perPage: 20,
    });

    if (error) throw error;

    const users = await Promise.all(
      data.users.map(async (user) => {
        const { count, error: countError } = await db
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id);

        if (countError || count === null) {
          throw countError ?? new Error("Order count unavailable");
        }

        const metadata = user.user_metadata;
        const name = [metadata?.name, metadata?.full_name].find(
          (value): value is string =>
            typeof value === "string" && value.trim().length > 0,
        );

        return {
          id: user.id,
          name: name?.trim().slice(0, 200) ?? "Нэр оруулаагүй",
          email: user.email ?? null,
          orders: count,
          joined: user.created_at,
        };
      }),
    );

    return NextResponse.json(
      { users, page, hasMore: data.nextPage != null },
      { headers },
    );
  } catch {
    return NextResponse.json(
      { error: "Хэрэглэгчдийн мэдээллийг ачаалж чадсангүй." },
      { status: 503, headers },
    );
  }
}