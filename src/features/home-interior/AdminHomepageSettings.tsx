"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/authFetch";
import { useAuth } from "@/store/auth";
import type { HomepageSettings } from "@/lib/homepageSettings";
import {
  DEFAULT_HOMEPAGE_HERO,
  parseHomepageHero,
  type HomepageHero,
} from "@/lib/homepagePresentation";
import { HomepagePreview } from "./HomepagePreview";
import { readAdminResource } from "@/features/dashboard/useAdminResource";
import "./homepage-editor.css";

type Result = HomepageSettings;
const FIELDS: { key: keyof HomepageHero; label: string; max: number }[] = [
  { key: "title", label: "Үндсэн гарчиг", max: 120 },
  { key: "description", label: "Тайлбар", max: 320 },
  {
    key: "image",
    label: "Зураг (HTTPS эсвэл / зам, хоосон бол каталогийн зураг)",
    max: 1000,
  },
  { key: "primaryLabel", label: "Үндсэн товчны нэр", max: 45 },
  { key: "primaryHref", label: "Үндсэн товчны холбоос", max: 240 },
  { key: "secondaryLabel", label: "Хоёр дахь товчны нэр", max: 45 },
  { key: "secondaryHref", label: "Хоёр дахь товчны холбоос", max: 240 },
];

export function AdminHomepageSettings() {
  const owner = useAuth((state) => state.user?.id);
  const [result, setResult] = useState<Result | null>(null);
  const [hero, setHero] = useState<HomepageHero>({ ...DEFAULT_HOMEPAGE_HERO });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const form = useRef<HTMLFormElement>(null);
  const selectField = (field: string) => {
    if (!FIELDS.some((item) => item.key === field)) return;
    const input = form.current?.elements.namedItem(field);
    if (input instanceof HTMLElement) {
      input.focus({ preventScroll: true });
      input.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };
  useEffect(() => {
    if (!owner) return;
    const controller = new AbortController();
    setResult(null);
    setError("");
    setSaved(false);
    void readAdminResource<Result>(owner, "/api/admin/homepage", attempt > 0)
      .then((data) => {
        if (!controller.signal.aborted) {
          setResult(data);
          setProductIds(data.productIds);
          setHero(data.hero ?? { ...DEFAULT_HOMEPAGE_HERO });
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

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!result || !owner || busy) return;
    const parsed = parseHomepageHero(hero);
    if (!parsed) {
      setError(
        "Гарчиг, тайлбар, товчны нэр болон холбоосыг шалгана уу. Холбоос нь /catalog, /planner, /kitchen зэрэг сайтын доторх зам байна.",
      );
      return;
    }
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
            ...result,
            hero: parsed,
            productIds,
            updateFeatured:
              JSON.stringify(productIds) !== JSON.stringify(result.productIds),
            products: undefined,
          }),
        },
        owner,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setResult(data);
      setHero(data.hero);
      setProductIds(data.productIds);
      setSaved(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Хадгалж чадсангүй.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="dashboard-panel homepage-editor"
      aria-labelledby="homepage-settings-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="homepage-settings-title" className="text-xl font-semibold">
            Нүүр хуудас засах
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-ui-muted">
            Платформыг танилцуулах гарчиг, зураг, товчнууд. Тоон үзүүлэлтүүд
            каталог болон идэвхтэй дэлгүүрүүдээс автоматаар шинэчлэгдэнэ.
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
        <div
          role="status"
          aria-label="Hero тохиргоог ачаалж байна"
          className="mt-6 grid gap-5 md:grid-cols-2"
        >
          {FIELDS.map((field) => (
            <div key={field.key} className="grid gap-2">
              <span className="h-3 w-28 rounded bg-ui-surface" />
              <span className="h-12 rounded border border-ui-line bg-ui-surface" />
            </div>
          ))}
        </div>
      )}
      {result && (
        <div className="homepage-editor-workspace">
          <form
            ref={form}
            onSubmit={(event) => void save(event)}
            className="homepage-editor-form"
          >
            <div className="homepage-editor-fields">
              {FIELDS.map((field) => (
                <label key={field.key} className="homepage-editor-field">
                  {field.label}
                  {field.key === "description" ? (
                    <textarea
                      name={field.key}
                      className="input"
                      value={hero[field.key]}
                      maxLength={field.max}
                      required
                      disabled={busy}
                      onChange={(event) => {
                        setHero((current) => ({
                          ...current,
                          [field.key]: event.target.value,
                        }));
                        setSaved(false);
                      }}
                    />
                  ) : (
                    <input
                      name={field.key}
                      className="input"
                      value={hero[field.key]}
                      maxLength={field.max}
                      required={field.key !== "image"}
                      disabled={busy}
                      onChange={(event) => {
                        setHero((current) => ({
                          ...current,
                          [field.key]: event.target.value,
                        }));
                        setSaved(false);
                      }}
                    />
                  )}
                </label>
              ))}
            </div>
            <label className="homepage-editor-field">
              Онцлох 3D бүтээгдэхүүн
              <select
                className="input"
                disabled={busy || !products.length}
                value={productIds[0] ?? ""}
                onChange={(event) => {
                  const id = event.target.value;
                  setProductIds((current) =>
                    id === current[1] ? [id, current[0]] : [id, current[1]],
                  );
                  setSaved(false);
                }}
              >
                {!products.some((p) => p.id === productIds[0]) && (
                  <option value={productIds[0]}>Одоогийн сонголт</option>
                )}
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? "Хадгалж байна…" : "Hero тохиргоог хадгалах"}
              </button>
              <button
                type="button"
                className="btn-ghost"
                disabled={busy}
                onClick={() => {
                  setHero(result.hero ?? { ...DEFAULT_HOMEPAGE_HERO });
                  setProductIds(result.productIds);
                  setSaved(false);
                  setError("");
                }}
              >
                Өөрчлөлт буцаах
              </button>
              {saved && (
                <p role="status" className="text-sm">
                  Хадгаллаа. Нүүр хуудсыг шинэчилж үзээрэй.
                </p>
              )}
            </div>
          </form>
          <HomepagePreview
            owner={owner!}
            hero={hero}
            productIds={productIds}
            onSelect={selectField}
            onProducts={setProducts}
          />
        </div>
      )}
    </section>
  );
}
