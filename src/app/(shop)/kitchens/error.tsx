"use client";

import { RetryError } from "@/components/RetryError";

export default function KitchensError({ reset }: { reset: () => void }) {
  return <RetryError reset={reset} title="Гал тогооны загваруудыг ачаалж чадсангүй" />;
}
