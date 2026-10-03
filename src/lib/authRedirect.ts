const KEY = "casa-auth-return";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function allowedDestination(next: string | null): string | null {
  if (next === "/checkout" || next === "/admin" || next === "/merchant" || next === "/account") return next;
  if (!next || !/^\/(?:planner|kitchen)(?:\?|$)/.test(next) || next.includes("\\") || next.includes("#")) return null;
  const url = new URL(next, "https://local.invalid"), query = new URLSearchParams();
  if (url.origin !== "https://local.invalid" || !["/planner", "/kitchen"].includes(url.pathname)) return null;
  const keys = url.pathname === "/planner" ? ["project", "kitchen"] : ["design", "draft"];
  for (const key of keys) { const value = url.searchParams.get(key); if (value && uuid.test(value)) query.set(key, value); }
  if (url.pathname === "/kitchen") for (const key of ["new", "importGuest"]) if (url.searchParams.get(key) === "1") query.set(key, "1");
  return `${url.pathname}${query.size ? `?${query}` : ""}`;
}
export function authDestination(search: string): string {
  const next = new URLSearchParams(search).get("next");
  return allowedDestination(next) ?? "/account";
}
export function rememberAuthDestination(search: string): string {
  const next = authDestination(search);
  try {
    if (next !== "/account") sessionStorage.setItem(KEY, next);
    else {
      const saved = sessionStorage.getItem(KEY);
      if (saved && allowedDestination(saved)) return allowedDestination(saved)!;
    }
  } catch { /* Navigation still works without browser storage. */ }
  return next;
}
export function finishAuthDestination(): string {
  const next = rememberAuthDestination(window.location.search);
  try { sessionStorage.removeItem(KEY); } catch { /* Optional storage. */ }
  return next;
}
