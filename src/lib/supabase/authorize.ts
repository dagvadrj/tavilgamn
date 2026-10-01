import "server-only";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "./admin";
import { apiErrorResponse } from "../api/errors";

type Role = "admin" | "merchant";
type AuthResult = { userId: string; error: null } | { userId: null; error: ReturnType<typeof apiErrorResponse> };

/** Fresh verified identity and DB role, never client-editable user_metadata. */
export async function authorize(request: NextRequest, role?: Role): Promise<AuthResult> {
  const reject = (status: number, error: string) =>
    ({ userId: null, error: apiErrorResponse({ error }, { status }) } as const);
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return reject(401, "Нэвтрэх шаардлагатай.");
  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db.auth.getUser(token);
    if (error && (error.status === 0 || (error.status ?? 0) >= 500))
      return reject(503, "Нэвтрэх эрхийг шалгах үйлчилгээ түр боломжгүй байна.");
    if (error || !data.user) return reject(401, "Нэвтрэх хугацаа дууссан байна. Дахин нэвтэрнэ үү.");
    if (role) {
      const { data: profile, error: profileError } = await db.from("profiles")
        .select("role").eq("id", data.user.id).maybeSingle();
      if (profileError) return reject(503, "Хэрэглэгчийн эрхийг шалгаж чадсангүй.");
      if (profile?.role !== role) return reject(403,
        role === "admin" ? "Admin эрх шаардлагатай." : "Дэлгүүр эрхлэгчийн эрх шаардлагатай.");
    }
    return { userId: data.user.id, error: null };
  } catch {
    return reject(503, "Нэвтрэх эрхийг шалгах үйлчилгээ түр боломжгүй байна.");
  }
}
