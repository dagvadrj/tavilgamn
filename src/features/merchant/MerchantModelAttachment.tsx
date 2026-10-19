"use client";
import { useState } from "react";
import { Upload } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { type MerchantGrowth } from "@/lib/merchantGrowth";
import { isOwner } from "./merchantApi";
import { growthStatus } from "./MerchantActivation";
import { useMerchantResource } from "./useMerchantResource";

export function MerchantModelAttachment({
  owner,
  productId,
  onBusy,
}: {
  owner: string;
  productId: string;
  onBusy: (value: boolean) => void;
}) {
  const [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const growth = useMerchantResource<MerchantGrowth>(
    owner,
    "/api/merchant/growth",
  );
  const submission = growth.data?.modelSubmissions.find(
    (item) => item.product_id === productId,
  );
  async function upload() {
    if (!file || busy) return;
    if (file.size > 50 * 1024 * 1024 || !/\.(glb|gltf)$/i.test(file.name)) {
      setError("GLB эсвэл self-contained glTF файл 50 MB хүртэл байна.");
      return;
    }
    setBusy(true);
    onBusy(true);
    setError("");
    setMessage("");
    try {
      const form = new FormData();
      form.set("kind", "model");
      form.set("productId", productId);
      form.set("file", file);
      const response = await authFetch(
        "/api/merchant/growth/files",
        { method: "POST", body: form },
        owner,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Файл илгээж чадсангүй.");
      if (!isOwner(owner)) return;
      window.dispatchEvent(
        new CustomEvent("merchant-data-changed", { detail: owner }),
      );
      growth.refresh();
      setMessage(
        "3D файл хяналтад илгээгдлээ. Шалгаж нийтэлсний дараа 3D каталогт харагдана.",
      );
      setFile(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Файл илгээгээгүй.");
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <div className="merchant-model-attachment">
      <label>
        Өөрийн 3D файл
        <input
          type="file"
          accept=".glb,.gltf"
          disabled={busy}
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        <small>
          GLB 2.0 эсвэл texture, binary өгөгдөл нь дотроо багтсан glTF 2.0 · 50
          MB хүртэл.
        </small>
      </label>
      <button
        type="button"
        className="btn-ghost"
        disabled={!file || busy}
        onClick={() => void upload()}
      >
        <Upload size={15} />
        {busy ? "Илгээж байна…" : "3D файл хавсаргах"}
      </button>
      {submission && (
        <p>
          Сүүлийн файл: {submission.original_name} ·{" "}
          {growthStatus(submission.status)} {submission.review_note}
        </p>
      )}
      {error && (
        <p className="merchant-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="merchant-success" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
