const KEY = "casa-auth-return";
export function authDestination(search: string): string {
  const next = new URLSearchParams(search).get("next");
  if (next === "/checkout" || next === "/admin") return next;
  return "/account";
}
export function rememberAuthDestination(search: string): string {
  const next = authDestination(search);
  try {
    if (next !== "/account") sessionStorage.setItem(KEY, next);
    else {
      const saved = sessionStorage.getItem(KEY);
      if (saved === "/checkout" || saved === "/admin") return saved;
    }
  } catch { /* Navigation still works without browser storage. */ }
  return next;
}
export function finishAuthDestination(): string {
  const next = rememberAuthDestination(window.location.search);
  try { sessionStorage.removeItem(KEY); } catch { /* Optional storage. */ }
  return next;
}
