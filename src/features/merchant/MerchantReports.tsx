"use client";
import { PageSkeleton } from "@/components/PageSkeleton";
import { useState } from "react";
import { FileDown, RefreshCw } from "lucide-react";
import { useMerchantResource } from "./useMerchantResource";
import { merchantDownload } from "./merchantDownload";
import {
  reportMoney,
  reportTotals,
  reportStatus,
  type MerchantReport,
} from "@/lib/merchantCommerce";
import "./merchant-commerce.css";
const day = (date: Date) =>
  date.toLocaleDateString("en-CA", { timeZone: "Asia/Ulaanbaatar" });
export function MerchantReports({ owner }: { owner: string }) {
  const [from, setFrom] = useState(() =>
      day(new Date(Date.now() - 29 * 86400000)),
    ),
    [to, setTo] = useState(() => day(new Date()));
  const [period, setPeriod] = useState(() => ({ from, to })),
    [error, setError] = useState(""),
    [busy, setBusy] = useState("");
  const path = `/api/merchant/reports?from=${period.from}&to=${period.to}`;
  const resource = useMerchantResource<{
    report: MerchantReport;
    totals: ReturnType<typeof reportTotals>;
  }>(owner, path);
  const data = resource.data;
  return (
    <section className="merchant-commerce">
      <div className="merchant-section-heading">
        <div>
          <h2>Дэлгүүрийн тайлан</h2>
          <p className="merchant-muted">
            Борлуулалт, захиалгын шимтгэл, хэтэвчийн гүйлгээ.
          </p>
        </div>
      </div>
      <form
        className="merchant-commerce-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          if (!from || !to || from > to) {
            setError("Огноогоо зөв сонгоно уу.");
            return;
          }
          if (from !== period.from || to !== period.to) setPeriod({ from, to });
          else resource.refresh();
        }}
      >
        <label>
          Эхлэх өдөр
          <input
            className="input"
            type="date"
            required
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          Дуусах өдөр
          <input
            className="input"
            type="date"
            required
            min={from}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <button className="btn-ghost" disabled={resource.loading}>
          <RefreshCw size={16} /> Тайлан харах
        </button>
      </form>
      <div className="merchant-commerce-toolbar">
        {(["xlsx", "pdf"] as const).map((format) => (
          <button
            key={format}
            className="btn-primary"
            disabled={!!busy || resource.loading || !data}
            onClick={async () => {
              setBusy(format);
              setError("");
              try {
                await merchantDownload(
                  path + `&format=${format}`,
                  owner,
                  `tailan-${period.from}-${period.to}.${format}`,
                );
              } catch (e) {
                setError(e instanceof Error ? e.message : "Татаж чадсангүй.");
              } finally {
                setBusy("");
              }
            }}
          >
            <FileDown size={16} />
            {busy === format
              ? "Үүсгэж байна…"
              : format === "xlsx"
                ? "Excel татах"
                : "PDF татах"}
          </button>
        ))}
      </div>
      {(error || resource.error) && (
        <p className="merchant-error" role="alert">
          {error || resource.error}
        </p>
      )}
      {resource.loading && !data && <PageSkeleton compact layout="metrics" />}
      {data && (
        <>
          <p>
            {data.report.from} - {data.report.to} · Захиалга үүссэн өдөр ·
            Улаанбаатарын цаг
          </p>
          <div className="merchant-commerce-summary">
            {[
              ["Захиалга", String(data.totals.orders)],
              ["Төлбөртэй захиалга", String(data.totals.paid)],
              ["Борлуулалтын дүн", reportMoney(data.totals.gross)],
              ["Шимтгэл", reportMoney(data.totals.fee)],
              ["Дэлгүүрийн дүн", reportMoney(data.totals.net)],
              [
                "Одоогийн боломжит үлдэгдэл",
                reportMoney(data.report.wallet.available),
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <span className="merchant-muted">{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <p className="merchant-muted">
            Шимтгэл нь захиалгын тухайн үеийн дүн. Төлбөргүй/цуцлагдсан
            захиалгууд борлуулалтын нийлбэрт орохгүй. Хэтэвчийн үлдэгдэл нь
            одоогийн бүх хугацааны дүн.
          </p>
          <div
            className="merchant-commerce-table"
            tabIndex={0}
            role="region"
            aria-label="Тайлангийн захиалгууд"
          >
            <table>
              <thead>
                <tr>
                  <th>Захиалга</th>
                  <th>Өдөр</th>
                  <th>Төлөв</th>
                  <th>Дүн</th>
                  <th>Шимтгэл</th>
                  <th>Дэлгүүрийн дүн</th>
                </tr>
              </thead>
              <tbody>
                {data.report.orders.slice(0, 100).map((order) => (
                  <tr key={order.orderId}>
                    <td>{order.orderId.slice(0, 8)}</td>
                    <td>{order.day}</td>
                    <td>
                      {order.cancelled
                        ? "Цуцлагдсан"
                        : reportStatus(order.stage)}{" "}
                      · {order.paid ? "Төлбөртэй" : "Төлбөргүй"}
                    </td>
                    <td>{reportMoney(order.gross)}</td>
                    <td>{reportMoney(order.fee)}</td>
                    <td>{reportMoney(order.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.report.orders.length && (
            <p>Сонгосон хугацаанд захиалга байхгүй.</p>
          )}
          {data.report.orders.length > 100 && (
            <p>
              Энд эхний 100 захиалга харагдана. Excel/PDF-д бүх{" "}
              {data.report.orders.length} захиалга орно.
            </p>
          )}
        </>
      )}
    </section>
  );
}
