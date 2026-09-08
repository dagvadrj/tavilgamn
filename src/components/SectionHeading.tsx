import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function SectionHeading({
  eyebrow,
  title,
  body,
  href,
  cta,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="mb-10 flex flex-col items-end justify-between gap-4 md:flex-row">
      <div className="max-w-2xl">
        {eyebrow && <p className="label mb-3">{eyebrow}</p>}
        <h2 className="font-display text-3xl leading-tight md:text-4xl">
          {title}
        </h2>
        {body && <p className="mt-3 text-ink/70">{body}</p>}
      </div>
      {href && cta && (
        <Link
          href={href}
          className="group inline-flex items-center gap-2 text-sm font-medium text-ink"
        >
          {cta}
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
        </Link>
      )}
    </div>
  );
}
