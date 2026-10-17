import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/requireAdmin";
import { privateHeaders } from "@/lib/api/errors";
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  return NextResponse.json({ allowed: true }, { headers: privateHeaders });
}
