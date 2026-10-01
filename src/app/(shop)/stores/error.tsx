"use client";

export default function StoresError({ reset }: { reset: () => void }) {
  return <div className="shop-container py-16 text-center">
    <h1 className="text-2xl font-medium">Дэлгүүрүүдийг ачаалж чадсангүй</h1>
    <p className="mt-3 text-sm text-[#6C726B]">Холболтоо шалгаад дахин оролдоно уу.</p>
    <button type="button" className="btn-primary mt-6" onClick={reset}>Дахин оролдох</button>
  </div>;
}
