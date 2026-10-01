import "server-only";
import type { NextRequest } from "next/server";
import { authorize } from "./authorize";

export function requireMerchant(request: NextRequest) {
  return authorize(request, "merchant");
}
