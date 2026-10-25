"use client";
import { PageSkeleton } from "@/components/PageSkeleton";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Package,
  RefreshCw,
  Truck,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { useMerchantResource } from "@/features/merchant/useMerchantResource";
import { useAuth } from "@/store/auth";
import { formatPrice } from "@/lib/format";
import type { DeliveryAddress, OrderLine } from "@/lib/orders";

type FulfillmentStatus = "pending" | "processing" | "shipped" | "delivered";
type MerchantOrder = {
  id: string;
  items: OrderLine[];
  subtotal: number;
  currency: "MNT";
  delivery: DeliveryAddress;
  created_at: string;
  status: FulfillmentStatus;
  paymentStatus: "pending_payment" | "paid" | "cancelled";
  commissionBps?: number;
  platformFee?: number;
  merchantNet?: number;
  cancellationStatus?:
    "requested" | "approved" | "rejected" | "refunded" | null;
};
const STATUS_LABEL: Record<FulfillmentStatus, string> = {
  pending: "Шинэ захиалга",
  processing: "Бэлтгэж буй",
  shipped: "Хүргэлтэд гарсан",
  delivered: "Хүргэгдсэн",
};
const NEXT_STATUS: Partial<Record<FulfillmentStatus, FulfillmentStatus>> = {
  pending: "processing",
};
const ACTION_LABEL: Partial<Record<FulfillmentStatus, string>> = {
  pending: "Бэлтгэж эхлэх",
};
const isOwner = (owner: string) =>
  useAuth.getState().user?.id === owner &&
  useAuth.getState().role === "merchant";

export function MerchantOrders({
  owner,
  onDelivery,
}: {
  owner: string;
  onDelivery?: () => void;
}) {
  const [page, setPage] = useState(0);
  const resource = useMerchantResource<{
    orders: MerchantOrder[];
    hasMore: boolean;
  }>(owner, `/api/merchant/orders?page=${page}`);
  const { data: result, error, refresh } = resource;
  const loading = resource.loading && !result;
  return (
    <section>
      <div className="merchant-section-heading">
        <div>
          <h2 className="text-2xl">Миний дэлгүүрийн захиалга</h2>
          <p className="merchant-muted">
            Танай дэлгүүрээс захиалсан бараа болон хүргэлтийн мэдээлэл.
          </p>
        </div>
        <button
          className="btn-ghost"
          disabled={loading}
          onClick={() => refresh()}
        >
          <RefreshCw size={16} />
          Шинэчлэх
        </button>
      </div>
      {loading ? (
        <PageSkeleton compact layout="rows" />
      ) : error ? (
        <p className="merchant-error" role="alert">
          {error}
        </p>
      ) : !result?.orders.length ? (
        <div className="merchant-panel merchant-state">
          <Package size={32} />
          <h3>Одоогоор захиалга алга</h3>
          <p>Таны барааг захиалахад мэдээлэл энд харагдана.</p>
        </div>
      ) : (
        <div className="merchant-orders">
          {result.orders.map((order) => (
            <MerchantOrderCard
              key={order.id}
              owner={owner}
              order={order}
              onDelivery={onDelivery}
              onUpdated={refresh}
            />
          ))}
        </div>
      )}
      <nav
        className="merchant-actions"
        aria-label="Дэлгүүрийн захиалгын хуудаслалт"
      >
        <span aria-live="polite" className="merchant-muted">
          Хуудас {page + 1}
        </span>
        <button
          type="button"
          className="btn-ghost"
          disabled={page === 0 || loading}
          onClick={() => setPage((value) => value - 1)}
        >
          <ChevronLeft size={15} />
          Өмнөх
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={loading || !!error || !result?.hasMore}
          onClick={() => setPage((value) => value + 1)}
        >
          Дараах
          <ChevronRight size={15} />
        </button>
      </nav>
    </section>
  );
}

function MerchantOrderCard({
  owner,
  order,
  onUpdated,
  onDelivery,
}: {
  owner: string;
  order: MerchantOrder;
  onUpdated: (status: FulfillmentStatus) => void;
  onDelivery?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const next = NEXT_STATUS[order.status];
  return (
    <article className="merchant-panel merchant-order">
      <header className="merchant-section-heading">
        <div>
          <h3>Захиалга #{order.id.slice(0, 8).toUpperCase()}</h3>
          <p>
            {new Date(order.created_at).toLocaleString("mn-MN", {
              timeZone: "Asia/Ulaanbaatar",
            })}
          </p>
        </div>
        <span className="merchant-order-status">
          {order.paymentStatus === "cancelled"
            ? "Цуцлагдсан"
            : STATUS_LABEL[order.status]}
        </span>
      </header>
      <div className="merchant-order-details">
        <div>
          <h4>Хүргэлтийн мэдээлэл</h4>
          <p>{order.delivery.name}</p>
          <p>{order.delivery.phone}</p>
          <p>{order.delivery.address}</p>
        </div>
        <div>
          <h4>Захиалсан бараа</h4>
          <ul>
            {order.items.map((item) => (
              <li
                key={JSON.stringify([
                  item.productId,
                  item.color,
                  item.material,
                ])}
              >
                <strong>
                  {item.name} × {item.qty}
                </strong>
                <p>
                  {item.colorName} · {item.materialName}
                </p>
                <p>{formatPrice(item.lineTotal)}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <footer className="merchant-order-footer">
        <span>
          {order.paymentStatus === "paid"
            ? "Төлбөр төлөгдсөн"
            : order.paymentStatus === "cancelled"
              ? "Захиалга цуцлагдсан"
              : "Төлбөр хүлээж буй"}
        </span>
        <span>
          Танай барааны дүн <strong>{formatPrice(order.subtotal)}</strong>
        </span>
      </footer>
      {order.platformFee != null && order.merchantNet != null && (
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 border-t pt-3 text-xs text-ui-muted">
          <span>
            Захиалга үүсэх үеийн шимтгэл {(order.commissionBps ?? 0) / 100}% ·{" "}
            {formatPrice(order.platformFee)}
          </span>
          <span>
            Дэлгүүрийн тооцооны дүн {formatPrice(order.merchantNet)}
            {order.paymentStatus === "cancelled" && " · цуцлагдсан"}
          </span>
          <span>Энэ нь данс руу мөнгө шилжүүлсэн баримт биш.</span>
        </div>
      )}
      {order.cancellationStatus === "requested" && (
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Цуцлах хүсэлтийг шалгаж байна. Шийдвэр гарах хүртэл бэлтгэл,
          хүргэлтийг түр зогсооно.
        </p>
      )}
      {order.paymentStatus === "paid" && (
        <Link
          href="/merchant?tab=delivery"
          className="btn-ghost mt-3"
          onClick={
            onDelivery
              ? (event) => {
                  event.preventDefault();
                  onDelivery();
                }
              : undefined
          }
        >
          <Truck size={16} />
          Хүргэлтийн самбарт удирдах
        </Link>
      )}
      {next &&
        order.paymentStatus === "paid" &&
        order.cancellationStatus !== "requested" && (
          <div className="merchant-actions">
            <button
              className="btn-primary"
              disabled={busy}
              onClick={async () => {
                if (busy) return;
                setBusy(true);
                setError(null);
                setMessage(null);
                try {
                  const response = await authFetch(
                    "/api/merchant/orders",
                    {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        id: order.id,
                        status: next,
                        expectedStatus: order.status,
                      }),
                    },
                    owner,
                  );
                  const data = await response.json();
                  if (!response.ok)
                    throw new Error(
                      data.error ?? "Захиалгын төлөвийг шинэчилж чадсангүй.",
                    );
                  if (isOwner(owner)) {
                    onUpdated(next);
                    setMessage("Захиалгын төлөв шинэчлэгдлээ.");
                  }
                } catch (reason) {
                  setError(
                    reason instanceof Error
                      ? reason.message
                      : "Захиалгын төлөвийг шинэчилж чадсангүй.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Truck size={16} />
              {busy ? "Шинэчилж байна…" : ACTION_LABEL[order.status]}
            </button>
          </div>
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
    </article>
  );
}
