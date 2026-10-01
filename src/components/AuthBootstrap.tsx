"use client";
import { useEffect } from "react";
import { useAuth } from "@/store/auth";

/** Authentication initialization belongs to the shared app, not the shop header. */
export function AuthBootstrap() {
  const initialize = useAuth(state => state.initialize);
  useEffect(() => { void initialize(); }, [initialize]);
  return null;
}
