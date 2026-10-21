"use client";
import { useState } from "react";
import { useMerchantResource } from "./useMerchantResource";
import type { MerchantGrowth } from "@/lib/merchantGrowth";
import { growthMoney } from "@/lib/merchantGrowth";
import { growthStatus } from "./MerchantActivation";
import "./merchant-showroom.css";
type Insights = {
  products: {
    productId: string;
    name: string;
    placements: number;
    orders: number;
    options: {
      kind: string;
      option_id: string;
      label?: string;
      sessions: number;
    }[];
  }[];
};
export function Merchant3dInsights({ owner }: { owner: string }) {
  const [days, setDays] = useState(7),
    resource = useMerchantResource<Insights>(
      owner,
      `/api/merchant/3d-insights?days=${days}`,
      true,
      60000,
    );
  return (
    <section className="merchant-panel showroom-insights">
      <header className="merchant-section-heading">
        <div>
          <h2>3D өрөөнд туршсан байдал</h2>
          <p>Өрөөнд байрлуулсан өвөрмөц сесс ба төлөгдсөн захиалга</p>
        </div>
        <div className="merchant-actions">
          {[7, 30, 90].map((n) => (
            <button
              type="button"
              className="btn-ghost"
              key={n}
              aria-pressed={n === days}
              onClick={() => setDays(n)}
            >
              {n} хоног
            </button>
          ))}
        </div>
      </header>
      {resource.error ? (
        <p role="alert">
          {resource.error}
          <button className="btn-ghost" onClick={resource.refresh}>
            Дахин ачаалах
          </button>
        </p>
      ) : !resource.data ? (
        <p role="status">Ачаалж байна…</p>
      ) : (
        <>
          <ul>
            {resource.data.products.slice(0, 6).map((p) => (
              <li key={p.productId}>
                <strong>{p.name}</strong>
                <p>
                  {p.placements} өрөөний сесс · {p.orders} төлөгдсөн захиалга
                </p>
                {p.options.map((o) => (
                  <small key={o.kind + o.option_id}>
                    {o.kind === "color" ? "Өнгө" : "Материал"}:{" "}
                    {o.label ?? o.option_id} · {o.sessions} сесс
                  </small>
                ))}
              </li>
            ))}
          </ul>
          {!resource.data.products.length && (
            <p>3D статистик хараахан бүртгэгдээгүй.</p>
          )}
          <small>
            Нэг сессийн давталтыг хасна. Захиалга нь тухайн хугацааны нийт
            борлуулалт; туршсан сессээс худалдан авсан гэж тооцоогүй.
          </small>
        </>
      )}
    </section>
  );
}
export function MerchantWalletWidget({
  owner,
  onOpen,
  onBank,
}: {
  owner: string;
  onOpen: () => void;
  onBank: () => void;
}) {
  const resource = useMerchantResource<MerchantGrowth>(
      owner,
      "/api/merchant/growth",
      true,
      30000,
    ),
    data = resource.data;
  return (
    <section className="merchant-panel showroom-insights">
      <header className="merchant-section-heading">
        <div>
          <h2>Боломжит үлдэгдэл</h2>
          <strong className="text-2xl">
            {data ? growthMoney(data.wallet.available) : "…"}
          </strong>
          <p>Төлөгдсөн, дууссан захиалгын орлогоос шимтгэл хасаж тооцно.</p>
        </div>
        <div className="merchant-actions">
          <button className="btn-ghost" onClick={onBank}>
            Данс холбох / засах
          </button>
          <button className="btn-primary" onClick={onOpen}>
            Мөнгө татах
          </button>
        </div>
      </header>
      {resource.error && <p role="alert">{resource.error}</p>}
      {data && (
        <>
          <p>Татан авалт хүлээгдэж буй: {growthMoney(data.wallet.reserved)}</p>
          <ul className="merchant-growth-history">
            {data.transactions.slice(0, 3).map((tx) => (
              <li key={tx.id}>
                <span>
                  {tx.kind === "withdrawal" ? "Орлого татах" : "Кредит авах"} ·{" "}
                  {new Date(tx.created_at).toLocaleDateString("mn-MN", {
                    timeZone: "Asia/Ulaanbaatar",
                  })}
                </span>
                <strong>
                  {growthMoney(tx.amount)} · {growthStatus(tx.status)}
                </strong>
              </li>
            ))}
          </ul>
          {!data.transactions.length && (
            <small>Гүйлгээний түүх хараахан байхгүй.</small>
          )}
        </>
      )}
    </section>
  );
}
