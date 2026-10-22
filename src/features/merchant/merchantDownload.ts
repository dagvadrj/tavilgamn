"use client";
import { authFetch } from "@/lib/authFetch";
import { useAuth } from "@/store/auth";
export async function merchantDownload(
  path: string,
  owner: string,
  filename: string,
) {
  const response = await authFetch(path, undefined, owner);
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(result?.error ?? "Файлыг татаж чадсангүй.");
  }
  const blob = await response.blob();
  if (useAuth.getState().user?.id !== owner)
    throw new Error("Хэрэглэгч солигдсон байна.");
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}
