"use client";
import { supabase } from "./supabase/client";

export async function authFetch(url: string, init?: RequestInit, expectedUserId?: string) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error("Үргэлжлүүлэхийн тулд нэвтэрнэ үү.");
  if (expectedUserId && data.session.user.id !== expectedUserId) throw new Error("Хэрэглэгч солигдсон байна. Хуудсаа шинэчилнэ үү.");
  return fetch(url, { ...init, cache: "no-store", headers: { ...init?.headers, Authorization: `Bearer ${data.session.access_token}` } });
}
