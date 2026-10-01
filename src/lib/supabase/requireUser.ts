import "server-only";
import type { NextRequest } from "next/server";
import { authorize } from "./authorize";

export function requireUser(request: NextRequest) {
  return authorize(request);
}
