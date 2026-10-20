"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { authFetch } from "@/lib/authFetch";
import { useAuth } from "@/store/auth";
import type { HomepageSettings } from "@/lib/homepageSettings";

type Result = HomepageSettings & {
  products: { id: string; name: string; image: string }[];
};

export function AdminHomepageSettings() {
  const owner = useAuth((state) => state.user?.id);
  const [result, setResult] = useState<Result | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!owner) return;
    const controller = new AbortController();
    setResult(null);
    setError("");
    setSaved(false);
    void authFetch("/api/admin/homepage", { signal: controller.signal }, owner)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (!controller.signal.aborted) {
          setResult(data);
          setSelection(data.productIds);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error ? error.message : "Тохиргоо ачаалсангүй.",
          );
      });
    return () => controller.abort();
  }, [owner, attempt]);

  async function save() {
    if (!result || !owner || busy) return;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const response = await authFetch(
        "/api/admin/homepage",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productIds: selection,
            version: result.version,
          }),
        },
        owner,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setResult({ ...result, ...data });
      setSaved(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Хадгалж чадсангүй.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="dashboard-panel mt-8 p-6"
      aria-labelledby="homepage-settings-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="homepage-settings-title" className="text-xl font-semibold">
            Нүүр хуудасны 3D буйдан
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-ui-muted">
            Эхний буйдан Скандинав, Дулаан загварт; хоёр дахь нь Модерн, Минимал
            загварт харагдана. Хадгалсан сонголт бүх хэрэглэгчид үйлчилнэ.
          </p>
        </div>
        <Link
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost"
        >
          Нүүр хуудсыг үзэх ↗
        </Link>
      </div>
      {error && (
        <div role="alert" className="my-4 text-sm text-red-700">
          {error}{" "}
          <button
            type="button"
            className="min-h-11 underline"
            disabled={busy}
            onClick={() => setAttempt((value) => value + 1)}
          >
            Дахин ачаалах
          </button>
        </div>
      )}
      {!result && !error && (
        <p role="status" className="py-6">
          3D загваруудыг ачаалж байна…
        </p>
      )}
      {result && (
        <>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {[0, 1].map((index) => {
              const product = result.products.find(
                (item) => item.id === selection[index],
              );
              return (
                <div
                  className="min-w-0 overflow-hidden rounded-xl border border-ui-line p-4"
                  key={index}
                >
                  <label className="grid gap-2 text-sm font-medium">
                    {index === 0
                      ? "Эхний өрөө / Скандинав, Дулаан"
                      : "Хоёр дахь сонголт / Модерн, Минимал"}
                    <select
                      value={selection[index] ?? ""}
                      className="input min-h-12 w-full"
                      disabled={busy}
                      onChange={(event) => {
                        setSelection((current) =>
                          current.map((id, i) =>
                            i === index ? event.target.value : id,
                          ),
                        );
                        setSaved(false);
                      }}
                    >
                      {!product && (
                        <option value={selection[index] ?? ""}>
                          Одоогийн загвар боломжгүй — дахин сонгоно уу
                        </option>
                      )}
                      {result.products.map((item) => (
                        <option
                          key={item.id}
                          value={item.id}
                          disabled={selection[1 - index] === item.id}
                        >
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {product && (
                    <div className="mt-4 flex items-center gap-4">
                      {product.image && (
                        <Image
                          src={product.image}
                          alt={product.name}
                          width={100}
                          height={80}
                          className="h-20 w-24 rounded-lg object-cover"
                          unoptimized
                        />
                      )}
                      <Link
                        href={`/product/${product.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-11 text-sm underline"
                      >
                        Бүтээгдэхүүнийг үзэх ↗
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <button
              type="button"
              className="btn-primary"
              disabled={
                busy ||
                selection.length !== 2 ||
                selection[0] === selection[1] ||
                selection.some(
                  (id) => !result.products.some((product) => product.id === id),
                )
              }
              onClick={() => void save()}
            >
              {busy ? "Хадгалж байна…" : "Нүүр хуудасны сонголтыг хадгалах"}
            </button>
            {saved && (
              <p role="status" className="text-sm text-ui-ink">
                Хадгаллаа. Нүүр хуудсыг шинэчилж үзээрэй.
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
