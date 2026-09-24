export type MerchantLocationTab =
  | "overview"
  | "products"
  | "orders"
  | "kitchens"
  | "quotes"
  | "store";

const MERCHANT_TABS = new Set<MerchantLocationTab>([
  "overview",
  "products",
  "orders",
  "kitchens",
  "quotes",
  "store",
]);
const UUID_PATTERN =
  /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

export function readMerchantLocation(search: string): {
  tab: MerchantLocationTab;
  designId: string | null;
} {
  const params = new URLSearchParams(search);
  const requestedTab = params.get("tab") as MerchantLocationTab | null;
  const tab = requestedTab && MERCHANT_TABS.has(requestedTab)
    ? requestedTab
    : "overview";
  const requestedDesign = params.get("design");

  return {
    tab,
    designId:
      tab === "kitchens" && requestedDesign && UUID_PATTERN.test(requestedDesign)
        ? requestedDesign
        : null,
  };
}

export function merchantLocationPath(
  pathname: string,
  search: string,
  hash: string,
  tab: MerchantLocationTab,
  designId?: string | null,
) {
  const params = new URLSearchParams(search);

  if (tab === "overview") params.delete("tab");
  else params.set("tab", tab);

  if (tab === "kitchens" && designId && UUID_PATTERN.test(designId)) {
    params.set("design", designId);
  } else {
    params.delete("design");
  }

  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}${hash}`;
}
