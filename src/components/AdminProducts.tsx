"use client";

import { useAuth } from "@/store/auth";
import { ProductList } from "@/features/admin-products/ProductList";

export function AdminProducts({
  onAddModel,
  initialProductId,
  onProductOpened,
}: {
  onAddModel: () => void;
  initialProductId?: string | null;
  onProductOpened?: () => void;
}) {
  const userId = useAuth((state) => state.user?.id);
  const role = useAuth((state) => state.role);

  if (!userId || role !== "admin") return null;

  return (
    <ProductList
      key={userId}
      owner={userId}
      onAddModel={onAddModel}
      initialProductId={initialProductId}
      onProductOpened={onProductOpened}
    />
  );
}
