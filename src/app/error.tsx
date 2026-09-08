"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto max-w-3xl p-10">
      <h1 className="font-display text-2xl">Мэдээллийг ачаалж чадсангүй.</h1>

      <p role="alert" className="mt-3 text-sm">
        Холболтоо шалгаад дахин оролдоно уу.
      </p>

      <button type="button" className="btn-primary mt-5" onClick={reset}>
        Дахин оролдох
      </button>
    </div>
  );
}
