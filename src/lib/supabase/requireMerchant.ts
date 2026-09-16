import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "./admin";

/** The role comes from the current profile, never editable user metadata. */
export async function requireMerchant(request: NextRequest): Promise<
  { userId: string; error: null } | { userId: null; error: NextResponse }
> {
  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
  const reject = (status: number, error: string) => ({
    userId: null,
    error: NextResponse.json({ error }, { status, headers: { "Cache-Control": "private, no-store" } }),
  });
  if (!token) return reject(401, "Нэвтрэх шаардлагатай.");
  const db = getSupabaseAdmin();
  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || !user) return reject(401, "Session хүчингүй байна.");
  const { data: profile, error: profileError } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profileError) return reject(503, "Хэрэглэгчийн эрхийг шалгаж чадсангүй.");
  if (profile?.role !== "merchant") return reject(403, "Дэлгүүр эрхлэгчийн эрх шаардлагатай.");
  return { userId: user.id, error: null };
}
