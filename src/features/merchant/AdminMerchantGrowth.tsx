"use client";
import { useEffect, useRef, useState } from "react";
import { Download, RefreshCw, ShieldCheck } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { useAuth } from "@/store/auth";
import {
  growthMoney,
  type AdminGrowth,
  type WalletTransaction,
} from "@/lib/merchantGrowth";
import { growthStatus } from "./MerchantActivation";
import { StatSkeleton } from "./MerchantStats";
import "./merchant-growth.css";

async function adminRequest<T>(
  owner: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  if (
    useAuth.getState().user?.id !== owner ||
    useAuth.getState().role !== "admin"
  )
    throw new Error("Нэвтрэлт өөрчлөгдсөн байна.");
  const response = await authFetch(path, init, owner),
    data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Үйлдэл амжилтгүй.");
  if (
    useAuth.getState().user?.id !== owner ||
    useAuth.getState().role !== "admin"
  )
    throw new Error("Нэвтрэлт өөрчлөгдсөн байна.");
  return data;
}
export function AdminMerchantGrowth() {
  const owner = useAuth((state) => state.user?.id),
    role = useAuth((state) => state.role);
  return owner && role === "admin" ? (
    <GrowthReview key={owner} owner={owner} />
  ) : null;
}
function GrowthReview({ owner }: { owner: string }) {
  const [data, setData] = useState<AdminGrowth | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0);
  const [tab, setTab] = useState("verification");
  const grantKey = useRef<{ signature: string; key: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void adminRequest<AdminGrowth>(owner, "/api/admin/merchant-growth", {
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error ? reason.message : "Ачаалж чадсангүй.",
          );
      });
    return () => controller.abort();
  }, [owner, revision]);
  async function mutate(action: string, payload: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await adminRequest<AdminGrowth>(
        owner,
        "/api/admin/merchant-growth",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...payload }),
        },
      );
      setData(result);
      setMessage("Шийдвэр хадгалагдлаа.");
      if (action === "grant") grantKey.current = null;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Хадгалж чадсангүй.");
    } finally {
      setBusy(false);
    }
  }
  async function download(query: string) {
    setError("");
    try {
      const result = await adminRequest<{ url: string }>(
        owner,
        `/api/admin/merchant-growth/file?${query}`,
      );
      window.location.assign(result.url);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Файл татаж чадсангүй.",
      );
    }
  }
  return (
    <section className="merchant-growth-page">
      <header className="merchant-growth-title">
        <div>
          <span className="merchant-growth-eyebrow">MERCHANT OPERATIONS</span>
          <h1>Баталгаажуулалт, хэтэвч</h1>
          <p>
            Гэрчилгээ, данс, орлого таталт, кредит болон ирсэн 3D файлуудыг
            хянана.
          </p>
        </div>
        <button
          type="button"
          className="btn-ghost"
          disabled={busy}
          onClick={() => {
            setError("");
            setRevision((value) => value + 1);
          }}
        >
          <RefreshCw size={15} />
          Шинэчлэх
        </button>
      </header>
      <nav
        className="merchant-growth-tabs"
        aria-label="Merchant хяналтын хэсгүүд"
      >
        {[
          ["verification", "Гэрчилгээ, данс"],
          ["withdrawals", "Орлого таталт"],
          ["credits", "Кредит"],
          ["models", "3D файлууд"],
        ].map(([id, label]) => (
          <button
            type="button"
            key={id}
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
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
      {!data ? (
        error ? null : (
          <StatSkeleton rows={5} />
        )
      ) : (
        <>
          {tab === "verification" && (
            <div className="merchant-growth-form-grid">
              {data.profiles.map((profile) => (
                <section
                  className="merchant-growth-panel"
                  key={profile.store_id}
                >
                  <header>
                    <ShieldCheck size={18} />
                    <h2>{profile.storeName}</h2>
                  </header>
                  <h3>{profile.legal_name || "ААН нэр оруулаагүй"}</h3>
                  <p>
                    Регистр: {profile.registration_no || "—"} ·{" "}
                    {growthStatus(profile.verification_status)}
                  </p>
                  {profile.certificate_path && (
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() =>
                        void download(
                          `storeId=${encodeURIComponent(profile.store_id!)}&kind=certificate`,
                        )
                      }
                    >
                      <Download size={14} />
                      Гэрчилгээ татах
                    </button>
                  )}
                  {profile.verification_status === "pending" && (
                    <ReviewForm
                      busy={busy}
                      onReview={(status, note) =>
                        void mutate("verification", {
                          storeId: profile.store_id,
                          status,
                          version: profile.verification_version,
                          note,
                        })
                      }
                    />
                  )}
                  <div className="merchant-growth-divider" />
                  <h3>
                    Орлого хүлээн авах данс ·{" "}
                    {growthStatus(profile.bank_status)}
                  </h3>
                  <p>
                    {profile.bank_name} · {profile.bank_account}
                    <br />
                    {profile.bank_holder}
                  </p>
                  {profile.bank_status === "pending" && (
                    <ReviewForm
                      busy={busy}
                      onReview={(status, note) =>
                        void mutate("bank", {
                          storeId: profile.store_id,
                          status,
                          version: profile.bank_version,
                          note,
                        })
                      }
                    />
                  )}
                </section>
              ))}
              {!data.profiles.length && <p>Хянах мэдээлэл одоогоор алга.</p>}
            </div>
          )}
          {tab === "withdrawals" && (
            <>
              <div className="merchant-growth-callout">
                Энэ самбар банкны шилжүүлэг хийхгүй. Банк дээр бодитоор
                шилжүүлсний дараа лавлагааны дугаараа оруулж “Шилжүүлсэн”
                болгоно.
              </div>
              {data.withdrawals.map((item) => (
                <WithdrawalReview
                  key={item.id}
                  item={item}
                  busy={busy}
                  onReview={(payload) => void mutate("withdrawal", payload)}
                />
              ))}
              {!data.withdrawals.length && <p>Орлого татах хүсэлт алга.</p>}
            </>
          )}
          {tab === "credits" && (
            <div className="merchant-growth-form-grid">
              <form
                key={`${data.settings.credit_price_mnt}`}
                className="merchant-growth-panel"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void mutate("settings", {
                    price: Number(form.get("price")),
                    background: Number(form.get("background")),
                    render: Number(form.get("render")),
                    model: Number(form.get("model")),
                  });
                }}
              >
                <h2>Кредитийн үнэ</h2>
                <p>
                  0 утгатай кредитийн худалдаа хаалттай байна. AI үйлчилгээний
                  холболтууд дараа нэмэгдэнэ.
                </p>
                <fieldset disabled={busy}>
                  {[
                    [
                      "price",
                      "1 кредитийн үнэ (₮)",
                      data.settings.credit_price_mnt,
                    ],
                    [
                      "background",
                      "Арын фон арилгах (кредит)",
                      data.settings.background_credits,
                    ],
                    [
                      "render",
                      "Интерьер render (кредит)",
                      data.settings.render_credits,
                    ],
                    [
                      "model",
                      "Зурагнаас 3D (кредит)",
                      data.settings.model_credits,
                    ],
                  ].map(([name, label, value]) => (
                    <label key={name}>
                      {label}
                      <input
                        name={String(name)}
                        type="number"
                        required
                        min="0"
                        max={name === "price" ? "1000000" : "100000"}
                        step="1"
                        defaultValue={value}
                      />
                    </label>
                  ))}
                  <button className="btn-primary">Үнэ хадгалах</button>
                </fieldset>
              </form>
              <form
                className="merchant-growth-panel"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  const payload = {
                    storeId: String(form.get("storeId")),
                    credits: Number(form.get("credits")),
                    reference: String(form.get("reference")),
                  };
                  const signature = JSON.stringify(payload);
                  if (grantKey.current?.signature !== signature)
                    grantKey.current = { signature, key: crypto.randomUUID() };
                  void mutate("grant", {
                    ...payload,
                    requestKey: grantKey.current.key,
                  });
                }}
              >
                <h2>Кредит цэнэглэх</h2>
                <p>
                  Төлбөр, гэрээ эсвэл урамшууллын бодит үндэслэлээ бүртгэнэ.
                </p>
                <fieldset disabled={busy}>
                  <label>
                    Дэлгүүр
                    <select name="storeId" required>
                      <option value="">Дэлгүүр сонгох</option>
                      {data.profiles.map((profile) => (
                        <option key={profile.store_id} value={profile.store_id}>
                          {profile.storeName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Кредитийн тоо
                    <input
                      name="credits"
                      type="number"
                      min="1"
                      max="1000000"
                      step="1"
                      required
                    />
                  </label>
                  <label>
                    Төлбөрийн дугаар / үндэслэл
                    <input
                      name="reference"
                      required
                      minLength={3}
                      maxLength={200}
                    />
                  </label>
                  <button className="btn-primary">Кредит бүртгэх</button>
                </fieldset>
              </form>
            </div>
          )}
          {tab === "models" && (
            <div className="merchant-growth-form-grid">
              {data.models.map((item) => (
                <section key={item.id} className="merchant-growth-panel">
                  <h2>{item.storeName}</h2>
                  <strong>{item.original_name}</strong>
                  <p>
                    Барааны ID: {item.product_id} · {growthStatus(item.status)}
                  </p>
                  <p>
                    Файлыг шалгаж, одоогийн 3D загварын удирдлагаар тухайн
                    бараанд нийтэлнэ. “Хүлээн авсан” төлөв дангаараа каталогт
                    нийтлэхгүй.
                  </p>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() =>
                      void download(
                        `id=${encodeURIComponent(item.id)}&kind=model`,
                      )
                    }
                  >
                    <Download size={14} />
                    3D файл татах
                  </button>
                  {item.status === "pending" && (
                    <ReviewForm
                      busy={busy}
                      acceptLabel="Файл хүлээн авсан"
                      onReview={(status, note) =>
                        void mutate("model", {
                          id: item.id,
                          storeId: item.store_id,
                          status:
                            status === "approved" ? "accepted" : "rejected",
                          note,
                        })
                      }
                    />
                  )}
                </section>
              ))}
              {!data.models.length && <p>Ирсэн 3D файл алга.</p>}
            </div>
          )}
        </>
      )}
    </section>
  );
}
function ReviewForm({
  busy,
  onReview,
  acceptLabel = "Батлах",
}: {
  busy: boolean;
  onReview: (status: string, note: string) => void;
  acceptLabel?: string;
}) {
  const [note, setNote] = useState("");
  return (
    <div className="merchant-growth-review-form">
      <label>
        Хяналтын тайлбар
        <textarea
          rows={2}
          maxLength={1000}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <div>
        <button
          type="button"
          className="btn-primary"
          disabled={busy}
          onClick={() => onReview("approved", note)}
        >
          {acceptLabel}
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={busy || note.trim().length < 3}
          onClick={() => onReview("rejected", note)}
        >
          Буцаах
        </button>
      </div>
    </div>
  );
}
function WithdrawalReview({
  item,
  busy,
  onReview,
}: {
  item: WalletTransaction;
  busy: boolean;
  onReview: (data: Record<string, unknown>) => void;
}) {
  const [reference, setReference] = useState(""),
    [note, setNote] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  return (
    <section className="merchant-growth-panel">
      <header>
        <h2>{item.storeName}</h2>
        <strong>{growthMoney(item.amount)}</strong>
        <span>{growthStatus(item.status)}</span>
      </header>
      <p>
        {item.bank_snapshot?.bank} · {item.bank_snapshot?.account} ·{" "}
        {item.bank_snapshot?.holder}
      </p>
      {item.status === "pending" ? (
        <fieldset disabled={busy}>
          <label>
            Шилжүүлгийн лавлагааны дугаар
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              maxLength={200}
            />
          </label>
          <label>
            Тайлбар
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={1000}
              rows={2}
            />
          </label>
          <label className="merchant-growth-checkbox">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            Банкны шилжүүлгийг бодитоор хийсэн.
          </label>
          <div className="merchant-growth-actions">
            <button
              type="button"
              className="btn-primary"
              disabled={!confirmed || reference.trim().length < 3}
              onClick={() =>
                onReview({
                  storeId: item.store_id,
                  id: item.id,
                  status: "paid",
                  reference,
                  transferConfirmed: confirmed,
                  note,
                })
              }
            >
              Шилжүүлсэн гэж бүртгэх
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={note.trim().length < 3}
              onClick={() =>
                onReview({
                  storeId: item.store_id,
                  id: item.id,
                  status: "rejected",
                  note,
                })
              }
            >
              Татгалзах, дүнг чөлөөлөх
            </button>
          </div>
        </fieldset>
      ) : (
        <small>
          {item.reference} {item.review_note}
        </small>
      )}
    </section>
  );
}
