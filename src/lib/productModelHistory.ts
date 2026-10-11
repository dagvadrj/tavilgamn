export type HistoryAsset = {
  id: string;
  version_id: string;
  role: string;
  state: string;
  byte_size: number | null;
  original_name: string | null;
  created_at: string;
};

export type ProductModelVersion = {
  id: string;
  createdAt: string;
  name: string;
  status: "current" | "published" | "incomplete" | "deleted";
  assetId: string | null;
  previewKind: string | null;
  byteSize: number | null;
};

export function productModelVersions(
  assets: HistoryAsset[],
  currentVersion: string | null,
): ProductModelVersion[] {
  const groups = new Map<string, HistoryAsset[]>();
  for (const asset of assets) {
    if (!["source", "preview", "delivery"].includes(asset.role)) continue;
    const group = groups.get(asset.version_id) ?? [];
    group.push(asset);
    groups.set(asset.version_id, group);
  }
  return [...groups]
    .map(([id, group]) => {
      const source = group.find((asset) => asset.role === "source");
      const published = group.some(
        (asset) =>
          ["delivery", "preview"].includes(asset.role) &&
          ["available", "retired"].includes(asset.state),
      );
      const selected = ["preview", "delivery", "source"]
        .map((role) =>
          group.find(
            (asset) =>
              asset.role === role &&
              (["available", "retired"].includes(asset.state) ||
                (role === "source" && asset.state === "pending")),
          ),
        )
        .find(Boolean);
      return {
        id,
        createdAt:
          source?.created_at ??
          group.map((asset) => asset.created_at).sort()[0],
        name: source?.original_name ?? `GLB · ${id.slice(0, 8)}`,
        status: published
          ? id === currentVersion
            ? "current"
            : "published"
          : selected
            ? "incomplete"
            : "deleted",
        assetId: selected?.id ?? null,
        previewKind: selected?.role ?? null,
        byteSize: selected?.byte_size ?? null,
      } satisfies ProductModelVersion;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
