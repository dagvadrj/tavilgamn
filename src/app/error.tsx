"use client";

import Link from "next/link";
import { CircleAlert, House, RotateCw } from "lucide-react";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main
      id="main-content"
      className="grid min-h-dvh flex-1 place-items-center bg-brand-surface px-5 py-12 text-ink"
    >
      <section
        className="w-full max-w-lg rounded-2xl border border-brand-border bg-brand-white p-8 text-center sm:p-10"
        aria-labelledby="page-error-title"
      >
        <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl bg-kitchen-tint text-kitchen">
          <CircleAlert size={26} aria-hidden="true" />
        </div>
        <p className="mb-2 text-xs font-semibold tracking-wide text-brand-muted">
          tavilga.mn
        </p>
        <div role="alert">
          <h1
            id="page-error-title"
            className="text-xl font-semibold tracking-tight sm:text-2xl"
          >
            Мэдээллийг ачаалж чадсангүй
          </h1>
          <p className="mt-3 text-sm leading-6 text-brand-muted">
            Түр алдаа гарлаа. Холболтоо шалгаад дахин оролдоно уу.
          </p>
        </div>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-brand-black bg-brand-black px-5 py-3 text-sm font-medium text-brand-white transition-colors hover:border-kitchen hover:bg-kitchen focus-visible:outline-kitchen"
            onClick={reset}
          >
            <RotateCw size={17} aria-hidden="true" />
            Дахин оролдох
          </button>
          <Link
            href="/"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-brand-border px-5 py-3 text-sm font-medium transition-colors hover:bg-brand-surface focus-visible:outline-kitchen"
          >
            <House size={17} aria-hidden="true" />
            Нүүр хуудас
          </Link>
        </div>
      </section>
    </main>
  );
}
