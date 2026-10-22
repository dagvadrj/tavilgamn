"use client";
import { useEffect, useState } from "react";
import { authFetch } from "@/lib/authFetch";
import { useAuth } from "@/store/auth";
import {
  parseQuotationLines,
  quotationTotal,
  quotationLineTotal,
  type KitchenCommerce,
  type QuotationLine,
} from "@/lib/kitchenQuotation";
import { formatPrice } from "@/lib/format";
import { useDraftState } from "@/hooks/useDashboardDraft";
import "@/features/merchant/merchant-showroom.css";
const initial: QuotationLine[] = [
  "Дээд шүүгээ",
  "Доод шүүгээ",
  "Чулуун тавцан",
  "Тоноглол",
].map((name) => ({ name, quantity: 1, unit: "ш", unitPrice: 0 }));
export function KitchenCommercePanel({
  actor,
  quoteId,
  merchant = false,
  status,
  onPublished,
}: {
  actor: string;
  quoteId: string;
  merchant?: boolean;
  status?: string;
  onPublished?: (total: number, note: string) => void;
}) {
  const [data, setData] = useState<KitchenCommerce | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0);
  const scope = `merchant:${actor}:quotation:${quoteId}`;
  const [items, setItems] = useDraftState<QuotationLine[]>(
      scope,
      "items",
      initial,
    ),
    [note, setNote] = useDraftState(scope, "note", "");
  const [date, setDate] = useState(""),
    [time, setTime] = useState("10:00"),
    [engineer, setEngineer] = useState(""),
    [duration, setDuration] = useState(60);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setData(null);
    setError("");
    void authFetch(
      `/api/kitchen-quotes/${quoteId}/commerce`,
      { signal: controller.signal },
      actor,
    )
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        if (active && useAuth.getState().user?.id === actor) setData(body);
      })
      .catch((e) => {
        if (active && !controller.signal.aborted) setError(e.message);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [actor, quoteId, refresh]);
  async function act(body: { action: string; [key: string]: unknown }) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await authFetch(
        `/api/kitchen-quotes/${quoteId}/commerce`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        actor,
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (useAuth.getState().user?.id !== actor) return;
      setData(result);
      if (body.action === "publish")
        onPublished?.(result.document.total, result.document.note);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Хадгалж чадсангүй.");
    } finally {
      setBusy(false);
    }
  }
  async function pdf() {
    if (!data?.document || busy) return;
    setBusy(true);
    setError("");
    try {
      const [{ kitchenQuotationPdf }, font] = await Promise.all([
        import("@/lib/kitchenQuotationPdf"),
        fetch("/fonts/pt-sans/PT_Sans-Web-Regular.ttf").then((r) => {
          if (!r.ok) throw new Error("PDF фонт ачаалагдаагүй.");
          return r.arrayBuffer();
        }),
      ]);
      const bytes = await kitchenQuotationPdf(data, new Uint8Array(font)),
        url = URL.createObjectURL(
          new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
        );
      const a = document.createElement("a");
      a.href = url;
      a.download = `quotation-${quoteId.slice(0, 8)}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF үүсгээгүй.");
    } finally {
      setBusy(false);
    }
  }
  const editable =
    merchant &&
    ["submitted", "reviewing"].includes(status ?? "") &&
    !data?.document;
  let total = 0;
  try {
    total = quotationTotal(items);
  } catch {
    /* Validate on submit. */
  }
  return (
    <section className="quotation-calendar">
      <h3>Модуль бүрийн үнийн санал</h3>
      {!data && !error && <p role="status">Ачаалж байна…</p>}
      {data?.document && (
        <>
          <ul>
            {data.document.items.map((item, i) => (
              <li className="flex flex-wrap justify-between gap-2 py-2" key={i}>
                <span>
                  {item.name} · {item.quantity} {item.unit} ×{" "}
                  {formatPrice(item.unitPrice)}
                </span>
                <strong>{formatPrice(quotationLineTotal(item))}</strong>
              </li>
            ))}
          </ul>
          <p>
            Нийт: <strong>{formatPrice(data.document.total)}</strong>
          </p>
          <p className="whitespace-pre-wrap">{data.document.note}</p>
          <button
            className="btn-ghost"
            disabled={busy}
            onClick={() => void pdf()}
          >
            PDF үнийн санал татах
          </button>
        </>
      )}
      {editable && data && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            try {
              void act({
                action: "publish",
                items: parseQuotationLines(items),
                note,
                expectedStatus: status,
              });
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <fieldset disabled={busy}>
            <div className="quotation-lines">
              {items.map((item, i) => (
                <div className="quotation-line" key={i}>
                  {(
                    [
                      ["name", "Модуль / ажил"],
                      ["quantity", "Тоо хэмжээ"],
                      ["unit", "Нэгж"],
                      ["unitPrice", "Нэгж үнэ (₮)"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <input
                        className="input"
                        required
                        type={
                          key === "quantity" || key === "unitPrice"
                            ? "number"
                            : "text"
                        }
                        min={key === "quantity" ? 0.01 : 0}
                        step={key === "quantity" ? 0.01 : 1}
                        max={
                          key === "quantity"
                            ? 10000
                            : key === "unitPrice"
                              ? 1000000000
                              : undefined
                        }
                        maxLength={key === "name" ? 200 : 20}
                        value={item[key]}
                        onChange={(e) =>
                          setItems(
                            items.map((v, n) =>
                              n === i
                                ? {
                                    ...v,
                                    [key]:
                                      key === "quantity" || key === "unitPrice"
                                        ? Number(e.target.value)
                                        : e.target.value,
                                  }
                                : v,
                            ),
                          )
                        }
                      />
                    </label>
                  ))}
                  <button
                    type="button"
                    className="btn-ghost"
                    aria-label={`${i + 1} мөр устгах`}
                    disabled={items.length === 1}
                    onClick={() => setItems(items.filter((_, n) => n !== i))}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              className="btn-ghost"
              type="button"
              disabled={items.length >= 50}
              onClick={() =>
                setItems([
                  ...items,
                  { name: "", quantity: 1, unit: "ш", unitPrice: 0 },
                ])
              }
            >
              + Мөр нэмэх
            </button>
            <p>
              Нийт: <strong>{formatPrice(total)}</strong>
            </p>
            <label>
              Нөхцөл, хугацаа
              <textarea
                className="input"
                maxLength={5000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <button className="btn-primary" type="submit">
              Үнийн санал үүсгэж илгээх
            </button>
          </fieldset>
        </form>
      )}
      <div className="quotation-calendar">
        <h3>Хэмжилтийн инженерийн цаг</h3>
        {data?.appointment && (
          <>
            <p>
              {data.appointment.engineer} ·{" "}
              {new Date(data.appointment.starts_at).toLocaleString("mn-MN", {
                timeZone: "Asia/Ulaanbaatar",
              })}{" "}
              –{" "}
              {new Date(data.appointment.ends_at).toLocaleTimeString("mn-MN", {
                timeZone: "Asia/Ulaanbaatar",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            <p>
              {
                {
                  proposed: "Баталгаажуулахыг хүлээж байна",
                  confirmed: "Хэрэглэгч баталсан",
                  declined: "Хэрэглэгч татгалзсан",
                }[data.appointment.status]
              }
            </p>
            {!merchant && data.appointment.status === "proposed" && (
              <div className="flex flex-wrap gap-2">
                <button
                  className="btn-primary"
                  disabled={busy}
                  onClick={() =>
                    void act({
                      action: "respond",
                      status: "confirmed",
                      version: data.appointment!.version,
                    })
                  }
                >
                  Цаг батлах
                </button>
                <button
                  className="btn-ghost"
                  disabled={busy}
                  onClick={() =>
                    void act({
                      action: "respond",
                      status: "declined",
                      version: data.appointment!.version,
                    })
                  }
                >
                  Татгалзах
                </button>
              </div>
            )}
          </>
        )}
        {merchant && status !== "closed" && data && (
          <form
            className="merchant-form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              const start = new Date(`${date}T${time}:00+08:00`);
              if (!Number.isFinite(start.getTime())) {
                setError("Цагаа зөв оруулна уу.");
                return;
              }
              void act({
                action: "schedule",
                engineer,
                startsAt: start.toISOString(),
                endsAt: new Date(
                  start.getTime() + duration * 60000,
                ).toISOString(),
                version: data.appointment?.version ?? null,
              });
            }}
          >
            <label>
              Инженер
              <input
                required
                minLength={2}
                maxLength={100}
                className="input"
                value={engineer}
                onChange={(e) => setEngineer(e.target.value)}
                disabled={busy}
              />
            </label>
            <label>
              Өдөр
              <input
                required
                className="input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={busy}
              />
            </label>
            <label>
              Цаг (Улаанбаатар)
              <input
                required
                className="input"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                disabled={busy}
              />
            </label>
            <label>
              Үргэлжлэх хугацаа
              <select
                className="input"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                disabled={busy}
              >
                {[30, 60, 90, 120].map((n) => (
                  <option key={n} value={n}>
                    {n} минут
                  </option>
                ))}
              </select>
            </label>
            <button className="btn-ghost" disabled={busy}>
              Хэмжилтийн цаг санал болгох
            </button>
          </form>
        )}
      </div>
      {error && (
        <p role="alert" className="merchant-error">
          {error}
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setRefresh((n) => n + 1)}
          >
            Шинэчлэх
          </button>
        </p>
      )}
    </section>
  );
}
