"use client";
/** Anonymous browser session, never a device fingerprint or a customer's address. */
export function trackProduct3d(
  productId: string,
  kind: "placement" | "color" | "material",
  option = "",
) {
  try {
    const key = "tavilga:3d-session";
    let sessionId = sessionStorage.getItem(key);
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem(key, sessionId);
    }
    void fetch("/api/products/engagement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        sessionId,
        productId,
        kind,
        option,
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* Optional analytics never interrupt the planner. */
  }
}
