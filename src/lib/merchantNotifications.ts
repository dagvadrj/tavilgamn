export type MerchantNotification = {
  id: string;
  kind: "kitchen_review" | "kitchen_quote";
  title: string;
  body: string;
  href: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

export function merchantNotificationFromRow(
  row: Record<string, unknown>,
): MerchantNotification {
  const metadata = row.metadata;

  return {
    id: String(row.id),
    kind: row.kind === "kitchen_quote" ? "kitchen_quote" : "kitchen_review",
    title: String(row.title),
    body: typeof row.body === "string" ? row.body : "",
    href: String(row.href),
    entityId: typeof row.entity_id === "string" ? row.entity_id : null,
    metadata:
      metadata && typeof metadata === "object" && !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>)
        : {},
    readAt: typeof row.read_at === "string" ? row.read_at : null,
    createdAt: String(row.created_at),
  };
}
