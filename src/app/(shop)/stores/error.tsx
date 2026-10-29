"use client";

import { RetryError } from "@/components/RetryError";

export default function StoresError({ reset }: { reset: () => void }) {
  return <RetryError reset={reset} title="Дэлгүүрүүдийг ачаалж чадсангүй" />;
}
