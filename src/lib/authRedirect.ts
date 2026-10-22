const KEY = "casa-auth-return";
type AccountRole = "customer" | "merchant" | "admin" | null;

const tabs = {
  "/merchant": [
    "overview",
    "activation",
    "wallet",
    "reports",
    "contracts",
    "products",
    "orders",
    "delivery",
    "branches",
    "staff",
    "reviews",
    "assistant",
    "returns",
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
    "merchant-ops",
    "contracts",
    "kitchen-library",
    "rooms",
  ],
};

// Accept only known app destinations, with a small allowlist of query fields.
export function safeAuthDestination(value: string | null): string | null {
  if (!value || value.length > 2048 || /[\u0000-\u0020\u007f\\]/.test(value))
    return null;
  if (
    [
      "/",
      "/account",
      "/checkout",
      "/cart",
      "/wishlist",
      "/planner",
      "/admin",
      "/merchant",
      "/catalog",
      "/stores",
      "/kitchens",
    ].includes(value)
  )
    return value;
  if (
    [
      "/account#orders",
      "/account#kitchen-garniture",
      "/account#profile",
      "/account#designs",
      "/account#kitchen-quotes",
      "/account#wishlist",
    ].includes(value)
  )
    return value;
  const productSection =
    /^(\/product\/[a-zA-Z0-9_-]+(?:\?[^#]+)?)#(product-(?:specifications|description|delivery|reviews|financing|details))$/.exec(
      value,
    );
  if (productSection) {
    const destination = safeAuthDestination(productSection[1]);
    return destination ? `${destination}#${productSection[2]}` : null;
  }
  const uuid =
    /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
  const room = /^\/planner\?([^#]+)$/.exec(value);
  if (room) {
    const params = new URLSearchParams(room[1]);
    for (const [key, field] of params) {
      if (params.getAll(key).length !== 1) return null;
      if (key === "design") {
        if (!/^d_[a-f0-9-]{36}$/i.test(field) || !uuid.test(field.slice(2)))
          return null;
      } else if (key === "kitchen" || key === "product") {
        if (!uuid.test(field)) return null;
      } else if (key === "library") {
        if (field !== "mine") return null;
      } else if (key === "setup") {
        if (field !== "1") return null;
      } else if (key === "source") {
        if (field !== "showroom") return null;
      } else return null;
    }
    return params.size ? `/planner?${params.toString()}` : null;
  }
  const shop =
    /^(\/catalog(?:\/[a-z0-9-]+|\/stores\/[a-f0-9-]{36})?|\/stores|\/store\/[a-z0-9-]+|\/product\/[a-zA-Z0-9_-]+|\/kitchens)(?:\?([^#]+))?$/.exec(
      value,
    );
  if (shop) {
    const path = shop[1],
      params = new URLSearchParams(shop[2]);
    const allowed = path.startsWith("/product/")
      ? ["color", "view"]
      : path === "/catalog"
        ? ["q", "room", "sort", "offers"]
        : path === "/stores"
          ? ["type"]
          : path === "/kitchens"
            ? ["q"]
            : [];
    for (const [key, field] of params) {
      if (
        !allowed.includes(key) ||
        params.getAll(key).length !== 1 ||
        field.length > 120 ||
        /[\u0000-\u001f\u007f]/.test(field)
      )
        return null;
      if (key === "view" && field !== "3d") return null;
      if (key === "offers" && field !== "1") return null;
    }
    return `${path}${params.size ? `?${params.toString()}` : ""}`;
  }
  if (/^\/orders\/[a-f0-9-]+$/i.test(value) && uuid.test(value.slice(8)))
    return value;
  if (
    /^\/kitchens\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) &&
    value.length <= 100
  )
    return value;
  if (value === "/kitchen") return value;
  const kitchen = /^\/kitchen\?([^#]+)$/.exec(value);
  if (kitchen) {
    const params = new URLSearchParams(kitchen[1]);
    for (const [key, field] of params) {
      if (params.getAll(key).length !== 1) return null;
      if (key === "design" || key === "draft") {
        if (!uuid.test(field)) return null;
      } else if (["importGuest", "new", "space"].includes(key)) {
        if (field !== "1") return null;
      } else return null;
    }
    if (!params.size) return null;
    return `/kitchen?${params.toString()}`;
  }
  const kitchenDetail =
    /^\/merchant\/kitchens\/([a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/i.exec(
      value,
    );
  if (kitchenDetail) return `/merchant/kitchens/${kitchenDetail[1]}`;
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
