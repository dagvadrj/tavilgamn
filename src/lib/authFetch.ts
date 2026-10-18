"use client";
import { supabase } from "./supabase/client";

export async function authFetch(
  url: string,
  init?: RequestInit,
  expectedUserId?: string,
) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session)
    throw new Error("Үргэлжлүүлэхийн тулд нэвтэрнэ үү.");
  if (expectedUserId && data.session.user.id !== expectedUserId)
    throw new Error("Хэрэглэгч солигдсон байна. Хуудсаа шинэчилнэ үү.");
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${data.session.access_token}`,
    },
  });
  if (
    response.ok &&
    init?.method &&
    !["GET", "HEAD"].includes(init.method.toUpperCase()) &&
    /^\/api\/merchant\/(orders|delivery|store|products|kitchen)/.test(url) &&
    typeof window !== "undefined"
  )
    window.dispatchEvent?.(
      new CustomEvent("merchant-data-changed", {
        detail: data.session.user.id,
      }),
    );
  return response;
}
