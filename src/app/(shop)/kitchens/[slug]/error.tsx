"use client";

import { RetryError } from "@/components/RetryError";

export default function KitchenError({ reset }: { reset: () => void }) {
  return <RetryError reset={reset} title="Гал тогооны загварыг ачаалж чадсангүй" />;
}
