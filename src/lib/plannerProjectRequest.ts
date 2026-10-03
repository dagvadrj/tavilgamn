"use client";
import { supabase } from "./supabase/client";
export class ProjectRequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function plannerProjectRequest(owner: string, url: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  if (!data.session || data.session.user.id !== owner) throw new ProjectRequestError("Хадгалахын тулд дахин нэвтэрнэ үү.", 401);
  const response = await fetch(url, { ...init, cache: "no-store", headers: { "Content-Type": "application/json", ...init.headers,
    Authorization: `Bearer ${data.session.access_token}` } });
  let body;
  try { body = await response.json(); } catch { throw new ProjectRequestError("Үйлчилгээний хариу буруу байна. Local өөрчлөлтөө хадгална уу.", response.status); }
  if (!response.ok) throw new ProjectRequestError(body.error || "Project үйлчилгээ холбогдсонгүй.", response.status);
  return body;
}
