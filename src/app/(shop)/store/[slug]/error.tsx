"use client";

import { RetryError } from "@/components/RetryError";

export default function StoreError({ reset }: { reset: () => void }) {
  return <RetryError reset={reset} title="Дэлгүүрийн мэдээллийг ачаалж чадсангүй" />;
}
