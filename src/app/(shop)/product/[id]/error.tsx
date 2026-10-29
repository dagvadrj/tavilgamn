"use client";

import { RetryError } from "@/components/RetryError";

export default function ProductError({ reset }: { reset: () => void }) {
  return <RetryError reset={reset} title="Барааны мэдээллийг ачаалж чадсангүй" />;
}
