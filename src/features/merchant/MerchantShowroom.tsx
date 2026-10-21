"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Printer, Box } from "lucide-react";
import { merchantRequest, isOwner, type MerchantProduct } from "./merchantApi";
import { useCatalogStore } from "@/store/catalog";
import { DeliveryDialog } from "./DeliveryStaffDialog";
import { authFetch } from "@/lib/authFetch";
import "./merchant-showroom.css";

function changed(owner: string) {
  window.dispatchEvent(
    new CustomEvent("merchant-data-changed", { detail: owner }),
  );
  void useCatalogStore.getState().refresh(true);
}
export function MadeToOrderSwitch({
  owner,
  product,
}: {
  owner: string;
  product: MerchantProduct;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [pending, setPending] = useState<boolean | null>(null);
  useEffect(() => {
    if (pending === (product.madeToOrder ?? false)) setPending(null);
  }, [pending, product.madeToOrder]);
  return (
    <div className="showroom-policy">
      <label>
        <input
          type="checkbox"
          role="switch"
          checked={pending ?? product.madeToOrder ?? false}
          disabled={busy || !!product.archivedAt}
          onChange={async (e) => {
            const enabled = e.target.checked;
            setPending(enabled);
            setBusy(true);
            setError("");
            try {
              await merchantRequest(
                `/api/merchant/products/${encodeURIComponent(product.id)}/policy`,
                owner,
                {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    enabled,
                    expected: product.madeToOrder ?? false,
                  }),
                },
              );
              if (isOwner(owner)) changed(owner);
            } catch (e) {
              setPending(null);
              setError(e instanceof Error ? e.message : "Хадгалж чадсангүй.");
            } finally {
              setBusy(false);
            }
          }}
        />
        <span>
          Захиалгаар хийнэ
          <small>{busy ? "Хадгалж байна…" : "Нөөц дуусвал 7–14 хоног"}</small>
        </span>
      </label>
      {error && <small role="alert">{error}</small>}
    </div>
  );
}
type Qr = { name: string; url: string; qr: string };
export function ProductQrButton({
  owner,
  product,
}: {
  owner: string;
  product: MerchantProduct;
}) {
  const [data, setData] = useState<Qr | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <button
        type="button"
        className="btn-ghost"
        disabled={busy || !product.model || !!product.archivedAt}
        title={
          !product.model
            ? "3D загвар бэлэн болсны дараа QR хэвлэнэ"
            : "Showroom QR хэвлэх"
        }
        aria-label={`${product.name} QR хэвлэх`}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const qr = await merchantRequest<Qr>(
              `/api/merchant/products/${encodeURIComponent(product.id)}/qr`,
              owner,
            );
            if (isOwner(owner)) setData(qr);
          } catch (e) {
            setError(e instanceof Error ? e.message : "QR үүсгээгүй.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Printer size={15} />
        QR
      </button>
      {error && <small role="alert">{error}</small>}
      {data && (
        <DeliveryDialog
          title="Барааны QR"
          busy={false}
          onClose={() => setData(null)}
        >
          <div className="showroom-qr">
            <h3>{data.name}</h3>
            {/* A local, server-generated PNG; no remote tracking image. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <Image
              unoptimized
              src={data.qr}
              alt={`${data.name} өрөөндөө байрлуулж үзэх QR`}
              width={220}
              height={220}
            />
            <strong>Гэртээ хэрхэн харагдахыг үзээрэй</strong>
            <p>Камераараа уншуулаад өрөөний хэмжээгээ оруулна уу.</p>
            <small>{data.url}</small>
          </div>
          <button
            className="btn-primary"
            onClick={() => {
              const frame = document.createElement("iframe");
              frame.title = "QR шошго хэвлэх";
              frame.style.cssText = "position:fixed;width:0;height:0;border:0";
              document.body.append(frame);
              const doc = frame.contentDocument;
              if (!doc) {
                frame.remove();
                return;
              }
              doc.open();
              doc.write(
                '<!doctype html><html lang="mn"><head><title>Showroom QR</title><style>@page{size:A6;margin:12mm}body{font:16px Arial;text-align:center}img{width:70mm}small{overflow-wrap:anywhere}</style></head><body></body></html>',
              );
              doc.close();
              const label = document
                .querySelector(".showroom-qr")
                ?.cloneNode(true);
              if (label) doc.body.append(label);
              const image = doc.querySelector("img");
              const print = () => {
                frame.contentWindow?.focus();
                frame.contentWindow?.print();
              };
              if (image?.complete) print();
              else if (image) image.onload = print;
              frame.contentWindow?.addEventListener(
                "afterprint",
                () => frame.remove(),
                { once: true },
              );
            }}
          >
            <Printer size={16} />
            Хэвлэх
          </button>
          <a
            className="btn-ghost"
            href={data.qr}
            download={`${product.id}-qr.png`}
          >
            QR зураг татах
          </a>
        </DeliveryDialog>
      )}
    </>
  );
}

export function ModelRequestButton({
  owner,
  product,
  onEdit,
}: {
  owner: string;
  product: MerchantProduct;
  onEdit: () => void;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (product.model || product.archivedAt) return null;
  return (
    <>
      <button
        type="button"
        className="btn-ghost"
        disabled={product.modelRequested}
        onClick={() => setOpen(true)}
      >
        <Box size={15} />
        {product.modelRequested ? "3D хүсэлттэй" : "3D загвар захиалах"}
      </button>
      {open && (
        <DeliveryDialog
          title="3D загвар хийлгэх хүсэлт"
          busy={busy}
          onClose={() => setOpen(false)}
        >
          <h3>{product.name}</h3>
          <p>
            Хүсэлттэй хамт барааны зургууд, {product.dimensions.w * 100} ×{" "}
            {product.dimensions.d * 100} × {product.dimensions.h * 100} см
            хэмжээг админд илгээнэ.
          </p>
          <p>
            {1 + (product.images?.length ?? 0)} зураг хавсаргана. Нэмэлт зураг,
            хэмжээ оруулах бол барааг засна уу.
          </p>
          <button className="btn-ghost" onClick={onEdit}>
            Зураг / хэмжээ засах
          </button>
          <button
            className="btn-primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const response = await authFetch(
                  "/api/merchant/products",
                  {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      ...product,
                      modelRequested: true,
                      expectedStockQuantity: product.stockQuantity ?? null,
                    }),
                  },
                  owner,
                );
                const data = await response.json();
                if (!response.ok) throw new Error(data.error);
                if (isOwner(owner)) {
                  changed(owner);
                  setOpen(false);
                }
              } catch (e) {
                setError(e instanceof Error ? e.message : "Илгээгээгүй.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Илгээж байна…" : "Хүсэлт илгээх"}
          </button>
          {error && <p role="alert">{error}</p>}
        </DeliveryDialog>
      )}
    </>
  );
}
