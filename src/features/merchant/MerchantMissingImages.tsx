"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowLeft, ImagePlus } from "lucide-react";
import { parseProduct } from "@/lib/catalogValidation";
import { normalizeProductName } from "@/lib/productImport";
import {
  type MerchantProduct,
  merchantRequest,
  missingImage,
  uploadMerchantImage,
} from "./merchantApi";
import "@/features/dashboard/product-import.css";

const fileKey = (file: File) =>
  normalizeProductName(file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "));

/** Photos dropped in bulk are suggested to products whose name equals the file name. */
export function MerchantMissingImages({
  owner,
  products,
  onSaved,
  onClose,
}: {
  owner: string;
  products: MerchantProduct[];
  onSaved: () => void;
  onClose: () => void;
}) {
  const missing = useMemo(() => products.filter(missingImage), [products]);
  const [files, setFiles] = useState<File[]>([]);
  const [assigned, setAssigned] = useState<Record<string, number>>({});
  const [done, setDone] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function add(list: FileList | null) {
    const images = Array.from(list ?? []).filter((file) =>
      ["image/jpeg", "image/png", "image/webp"].includes(file.type),
    );
    if (!images.length) {
      setError("JPG, PNG эсвэл WebP зураг сонгоно уу.");
      return;
    }
    setError("");
    const next = [...files, ...images].slice(0, 200);
    setFiles(next);
    setAssigned((current) => {
      const result = { ...current };
      for (const product of missing) {
        if (result[product.id] !== undefined) continue;
        const match = next.findIndex(
          (file, index) =>
            fileKey(file) === normalizeProductName(product.name) &&
            !Object.values(result).includes(index),
        );
        if (match >= 0) result[product.id] = match;
      }
      return result;
    });
  }

  async function save() {
    setBusy(true);
    setError("");
    const saved = new Set(done);
    try {
      for (const product of missing) {
        const index = assigned[product.id];
        if (index === undefined || saved.has(product.id)) continue;
        const image = await uploadMerchantImage(files[index], owner);
        // Same canonical save as the product editor, with optimistic stock check.
        await merchantRequest("/api/merchant/products", owner, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...parseProduct({ ...product, image }),
            modelRequested: Boolean(product.modelRequested),
            expectedStockQuantity: product.stockQuantity ?? null,
          }),
        });
        saved.add(product.id);
        setDone(new Set(saved));
      }
      onSaved();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Зургийг холбож чадсангүй.",
      );
    } finally {
      setBusy(false);
    }
  }

  const pending = missing.filter(
    (product) => assigned[product.id] !== undefined && !done.has(product.id),
  ).length;
  return (
    <section className="product-import" aria-labelledby="missing-images-heading">
      <header className="product-import-heading">
        <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
          <ArrowLeft size={16} /> Буцах
        </button>
        <div>
          <h1 id="missing-images-heading">Зураг дутуу бараа · {missing.length}</h1>
          <p>Зургийн файлын нэр барааны нэртэй ижил бол автоматаар холбогдоно.</p>
        </div>
      </header>
      <div
        className="product-import-drop"
        data-dragging={dragging || undefined}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          add(event.dataTransfer.files);
        }}
      >
        <ImagePlus size={22} aria-hidden="true" />
        <strong>Олон зургаа энд чирж оруулна уу</strong>
        <small>JPG, PNG, WebP · нэг бүр 3 MB хүртэл · ж: «Ногоон буйдан.jpg»</small>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          accept="image/jpeg,image/png,image/webp"
          aria-label="Зургууд сонгох"
          onChange={(event) => {
            add(event.target.files);
            event.target.value = "";
          }}
        />
        <button type="button" className="btn-ghost" disabled={busy} onClick={() => inputRef.current?.click()}>
          Зураг сонгох
        </button>
      </div>
      {error && (
        <p className="product-import-error" role="alert">
          {error}
        </p>
      )}
      {missing.length ? (
        <div className="product-import-table" data-compact="" role="region" aria-label="Зураг холбох" tabIndex={0}>
          <table>
            <thead>
              <tr>
                <th scope="col">Бараа</th>
                <th scope="col">Зураг</th>
                <th scope="col">Төлөв</th>
              </tr>
            </thead>
            <tbody>
              {missing.map((product) => (
                <tr key={product.id} data-status={done.has(product.id) ? "ok" : assigned[product.id] !== undefined ? "warning" : undefined}>
                  <th scope="row">{product.name}</th>
                  <td>
                    <select
                      aria-label={`${product.name}: зураг`}
                      value={assigned[product.id] ?? ""}
                      disabled={busy || done.has(product.id) || !files.length}
                      onChange={(event) =>
                        setAssigned((current) => {
                          const next = { ...current };
                          if (event.target.value === "") delete next[product.id];
                          else next[product.id] = Number(event.target.value);
                          return next;
                        })
                      }
                    >
                      <option value="">{files.length ? "Сонгох…" : "Эхлээд зураг оруулна"}</option>
                      {files.map((file, index) => (
                        <option key={`${file.name}-${index}`} value={index}>
                          {file.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span className="product-import-status">
                      {done.has(product.id)
                        ? "Холбогдсон"
                        : assigned[product.id] !== undefined
                          ? "Хадгалахад бэлэн"
                          : "Зураггүй"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="product-import-empty">Бүх бараа зурагтай байна.</p>
      )}
      <div className="product-import-bar">
        <span role="status">
          {busy ? `Хадгалж байна… ${done.size}` : `${pending} барааны зураг холбоход бэлэн`}
        </span>
        <button type="button" className="btn-primary" disabled={busy || !pending} onClick={() => void save()}>
          {busy ? "Хадгалж байна…" : "Зургуудыг хадгалах"}
        </button>
      </div>
      <p className="merchant-muted">
        3D (GLB) загварыг бараа бүрийн «Засах» хэсгээс хавсаргана.
      </p>
    </section>
  );
}
