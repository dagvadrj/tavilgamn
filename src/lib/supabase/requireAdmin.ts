import "server-only";
import type { NextRequest } from "next/server";
import { authorize } from "./authorize";

export function requireAdmin(request: NextRequest) {
  return authorize(request, "admin");
}
