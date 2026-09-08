import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "./admin";

export async function requireUser(request: NextRequest) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) {
    return { userId: null, error: NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 }) } as const;
  }
  const { data, error } = await getSupabaseAdmin().auth.getUser(token);
  if (error || !data.user) {
    return { userId: null, error: NextResponse.json({ error: "Нэвтрэх хугацаа дууссан байна. Дахин нэвтэрнэ үү." }, { status: 401 }) } as const;
  }
  return { userId: data.user.id, error: null } as const;
}
