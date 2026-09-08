import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type AdminAuthResult =
  | {
      userId: string;
      error: null;
    }
  | {
      userId: null;
      error: NextResponse;
    };

export async function requireAdmin(
  request: NextRequest,
): Promise<AdminAuthResult> {
  const authorization =
    request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return {
      userId: null,
      error: NextResponse.json(
        { error: "Нэвтрэх шаардлагатай" },
        { status: 401 },
      ),
    };
  }

  const accessToken = authorization.slice(7).trim();

  if (!accessToken) {
    return {
      userId: null,
      error: NextResponse.json(
        { error: "Session token олдсонгүй" },
        { status: 401 },
      ),
    };
  }

  const supabase = getSupabaseAdmin();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(accessToken);

  if (userError || !user) {
    return {
      userId: null,
      error: NextResponse.json(
        { error: "Session хүчингүй байна" },
        { status: 401 },
      ),
    };
  }

  const { data: profile, error: profileError } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

  if (profileError) {
    return {
      userId: null,
      error: NextResponse.json(
        { error: "Хэрэглэгчийн эрхийг шалгаж чадсангүй" },
        { status: 500 },
      ),
    };
  }

  if (profile?.role !== "admin") {
    return {
      userId: null,
      error: NextResponse.json(
        { error: "Admin эрх шаардлагатай" },
        { status: 403 },
      ),
    };
  }

  return {
    userId: user.id,
    error: null,
  };
}