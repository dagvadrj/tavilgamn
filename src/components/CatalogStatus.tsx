"use client";

export function CatalogStatus({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: string | null;
  retry: () => void;
}) {
  if (error) {
    return (
      <div className="p-6">
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
        <button type="button" className="mt-3 underline" onClick={retry}>
          Дахин оролдох
        </button>
      </div>
    );
  }

  return (
    <p role="status" className="p-6 text-sm">
      {loading ? "Тавилга ачаалж байна…" : "Тавилгын мэдээллийг бэлдэж байна…"}
    </p>
  );
}
