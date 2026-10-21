"use client";
import { useState } from "react";
import Image from "next/image";
import { useAuth } from "@/store/auth";
import { DeliveryDialog } from "./DeliveryStaffDialog";
import { authFetch } from "@/lib/authFetch";
import type { MerchantDeliveryOrder } from "@/lib/merchantDelivery";
export function DeliveryProofViewer({ orderId }: { orderId: string }) {
  const actor = useAuth((s) => s.user?.id),
    role = useAuth((s) => s.role);
  const [url, setUrl] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (!actor || role !== "merchant")
    return <small>✓ Хүлээлгэн өгсөн баримттай</small>;
  return (
    <>
      <button
        type="button"
        className="btn-ghost"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const r = await authFetch(
                `/api/merchant/delivery/proof?orderId=${encodeURIComponent(orderId)}`,
                undefined,
                actor,
              ),
              data = await r.json();
            if (!r.ok) throw new Error(data.error);
            if (useAuth.getState().user?.id === actor) setUrl(data.url);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Хүлээлгэн өгсөн зураг харах
      </button>
      {error && <small role="alert">{error}</small>}
      {url && (
        <DeliveryDialog
          title="Хүлээлгэн өгсөн зураг"
          busy={false}
          onClose={() => setUrl("")}
        >
          <Image
            unoptimized
            src={url}
            alt="Хүргэлт хүлээлгэн өгсөн баримт"
            width={800}
            height={800}
            style={{ width: "100%", height: "auto" }}
          />
        </DeliveryDialog>
      )}
    </>
  );
}
export function DeliveryProofDialog({
  owner,
  order,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  owner: string;
  order: MerchantDeliveryOrder;
  busy: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null),
    [uploading, setUploading] = useState(false),
    [uploaded, setUploaded] = useState(order.proofAvailable ?? false),
    [failure, setFailure] = useState("");
  return (
    <DeliveryDialog
      title="Хүлээлгэн өгсөн баримт"
      busy={busy || uploading}
      onClose={onClose}
    >
      <p>
        #{order.id.slice(0, 8)} · {order.delivery.name}
      </p>
      <p>
        Гэрт нь байрлуулж, угсарч хүлээлгэн өгсөн тавилгын зургийг хавсаргана
        уу.
      </p>
      <label>
        Хүргэлтийн зураг
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          disabled={busy || uploading}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setUploaded(false);
          }}
        />
        <small>JPG, PNG, WebP · 5 MB хүртэл</small>
      </label>
      {uploaded && (
        <p role="status">
          ✓ Зураг хадгалагдсан. Хүргэгдсэнээр баталгаажуулна уу.
        </p>
      )}
      <button
        className="btn-primary"
        disabled={busy || uploading || (!file && !uploaded)}
        onClick={async () => {
          setFailure("");
          if (!uploaded && file) {
            if (file.size > 5 * 1024 * 1024) {
              setFailure("Зураг 5 MB хүртэл байна.");
              return;
            }
            setUploading(true);
            try {
              const form = new FormData();
              form.set("orderId", order.id);
              form.set("file", file);
              const response = await authFetch(
                "/api/merchant/delivery/proof",
                { method: "POST", body: form },
                owner,
              );
              const data = await response.json();
              if (!response.ok) throw new Error(data.error);
              setUploaded(true);
            } catch (e) {
              setFailure(
                e instanceof Error ? e.message : "Зураг хадгалагдаагүй.",
              );
              return;
            } finally {
              setUploading(false);
            }
          }
          await onConfirm();
        }}
      >
        {busy || uploading
          ? "Хадгалж байна…"
          : "Зурагтай баталгаажуулж хүргэгдсэн болгох"}
      </button>
      {(failure || error) && (
        <p role="alert" className="merchant-error">
          {failure || error}
        </p>
      )}
    </DeliveryDialog>
  );
}
