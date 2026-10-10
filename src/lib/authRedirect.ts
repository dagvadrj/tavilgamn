const KEY = "casa-auth-return";
type AccountRole = "customer" | "merchant" | "admin" | null;

const tabs = {
  "/merchant": [
    "overview",
    "products",
    "orders",
    "kitchens",
    "quotes",
    "store",
    "settings",
    "profile",
  ],
  "/admin": [
    "dashboard",
    "merchants",
    "furniture",
    "orders",
    "users",
    "messages",
    "models",
    "kitchens",
    "settings",
    "profile",
  ],
};

// Accept only known app destinations, with a small allowlist of query fields.
export function safeAuthDestination(value: string | null): string | null {
  if (!value) return null;
  if (["/account", "/checkout", "/admin", "/merchant"].includes(value))
    return value;
  const match = /^(\/merchant|\/admin)\?([^#]+)$/.exec(value);
  if (!match) return null;
  const path = match[1] as keyof typeof tabs;
  const params = new URLSearchParams(match[2]);
  const tab = params.get("tab");
  if (!tab || !tabs[path].includes(tab) || params.getAll("tab").length !== 1)
    return null;
  for (const key of params.keys())
    if (key !== "tab" && key !== "design") return null;
  if (
    params.has("design") &&
    (path !== "/merchant" ||
      tab !== "kitchens" ||
      params.getAll("design").length !== 1 ||
      !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(
        params.get("design") ?? "",
      ))
  )
    return null;
  return `${path}?${params.toString()}`;
}

export function accountPathForRole(role: AccountRole): string {
  if (role === "merchant") return "/merchant?tab=profile";
  if (role === "admin") return "/admin?tab=profile";
  return "/account";
}

export function loginPathForDestination(destination: string): string {
  const next =
    safeAuthDestination(destination) ??
    (destination.startsWith("/merchant?")
      ? "/merchant"
      : destination.startsWith("/admin?")
        ? "/admin"
        : "/account");
  return `/login?next=${encodeURIComponent(next)}`;
}

export function authDestination(search: string): string {
  return (
    safeAuthDestination(new URLSearchParams(search).get("next")) ?? "/account"
  );
}

export function rememberAuthDestination(search: string): string {
  const params = new URLSearchParams(search);
  const next = authDestination(search);
  try {
    if (params.has("next")) sessionStorage.setItem(KEY, next);
    else return safeAuthDestination(sessionStorage.getItem(KEY)) ?? next;
  } catch {
    /* Navigation still works without browser storage. */
  }
  return next;
}

export function finishAuthDestination(role?: AccountRole): string {
  const next = rememberAuthDestination(window.location.search);
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* Optional storage. */
  }
  if (next === "/account" && (role === "merchant" || role === "admin"))
    return `/${role}`;
  return next;
}
