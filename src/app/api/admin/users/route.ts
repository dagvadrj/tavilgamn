import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/requireAdmin";
import { CatalogInputError } from "@/lib/catalogValidation";
import { merchantObject } from "@/lib/merchantValidation";
import { merchantError } from "@/lib/merchantServer";

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

    const ids = data.users.map(user => user.id);
    const [profileResult, storeResult] = ids.length ? await Promise.all([
      db.from("profiles").select("id,role").in("id", ids),
      db.from("merchant_stores").select("id,owner_id,name,store_type").in("owner_id", ids),
    ]) : [{ data: [], error: null }, { data: [], error: null }];
    if (profileResult.error || storeResult.error) throw profileResult.error ?? storeResult.error;

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
          role: profileResult.data?.find(profile => profile.id === user.id)?.role ?? "customer",
          store: (() => {
            const store = storeResult.data?.find(store => store.owner_id === user.id);
            return store ? { id: store.id, name: store.name, storeType: store.store_type } : null;
          })(),
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

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) {
      auth.error.headers.set("Cache-Control", headers["Cache-Control"]);
      return auth.error;
    }
    const raw = merchantObject(await request.json().catch(() => { throw new CatalogInputError("JSON буруу байна."); }));
    if (typeof raw.id !== "string" || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(raw.id)
      || (raw.role !== "merchant" && raw.role !== "customer")) throw new CatalogInputError("Хэрэглэгч эсвэл эрхийн сонголт буруу байна.");
    const { error } = await getSupabaseAdmin().rpc("set_merchant_role", { p_actor: auth.userId, p_target: raw.id, p_role: raw.role });
    if (error) throw error;
    return NextResponse.json({ ok: true }, { headers });
  } catch (error) { return merchantError(error, "Хэрэглэгчийн эрхийг шинэчилж чадсангүй."); }
}
