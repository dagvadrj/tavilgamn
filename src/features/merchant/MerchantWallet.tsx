"use client";
import { useRef, useState } from "react";
import { ArrowUpRight, Wallet, Sparkles } from "lucide-react";
import {
  growthCount,
  growthMoney,
  type MerchantGrowth,
} from "@/lib/merchantGrowth";
import { merchantRequest } from "./merchantApi";
import { useMerchantResource } from "./useMerchantResource";
import { growthStatus } from "./MerchantActivation";
import { StatSkeleton } from "./MerchantStats";
import "./merchant-growth.css";

export function MerchantWallet({
  owner,
  onSetup,
}: {
  owner: string;
  onSetup: () => void;
}) {
  const resource = useMerchantResource<MerchantGrowth>(
    owner,
    "/api/merchant/growth",
    true,
    60000,
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const request = useRef<{ signature: string; key: string } | null>(null);
  const [credits, setCredits] = useState("10");
  if (!resource.data)
    return resource.error ? (
      <p className="merchant-error" role="alert">
        {resource.error}
        <button onClick={resource.refresh}>Дахин оролдох</button>
      </p>
    ) : (
      <StatSkeleton rows={5} />
    );
  const data = resource.data,
    wallet = data.wallet;
  const verified = data.profile.verification_status === "approved";
  const canWithdraw =
    verified &&
    data.profile.bank_status === "approved" &&
    BigInt(wallet.available) > 0n;
  const price = BigInt(data.settings.credit_price_mnt),
    quantity = /^\d{1,7}$/.test(credits) ? BigInt(credits) : 0n;
  async function act(kind: string, value: string) {
    if (busy) return;
    const quantity = Number(value);
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      setError("Эерэг бүхэл тоо оруулна уу.");
      return;
    }
    const signature = `${kind}:${quantity}`;
    if (request.current?.signature !== signature)
      request.current = { signature, key: crypto.randomUUID() };
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await merchantRequest("/api/merchant/growth/wallet", owner, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          quantity,
          requestKey: request.current.key,
        }),
      });
      request.current = null;
      window.dispatchEvent(
        new CustomEvent("merchant-data-changed", { detail: owner }),
      );
      resource.refresh();
      setMessage(
        kind === "withdrawal"
          ? "Орлого татах хүсэлт бүртгэгдлээ. Admin банкны шилжүүлгийг шалгаж шийдвэрлэнэ."
          : "Кредит цэнэглэгдлээ.",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Үйлдэл амжилтгүй.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="merchant-growth-page">
      <header>
        <span className="merchant-growth-eyebrow">САНХҮҮ</span>
        <h1>Хэтэвч ба AI / 3D кредит</h1>
        <p>
          Төлбөр баталгаажиж, хүргэлт дууссан захиалгын цэвэр орлого энд
          тооцогдоно. Шимтгэлийг захиалгад хадгалсан хувиар хасна; шинэ
          дэлгүүрийн үндсэн шимтгэл 5%.
        </p>
      </header>
      <div className="merchant-wallet-cards">
        <article className="merchant-growth-panel is-orange">
          <Wallet size={20} />
          <span>Татах боломжит үлдэгдэл</span>
          <strong>{growthMoney(wallet.available)}</strong>
          <small>Нийт орсон орлого {growthMoney(wallet.earned)}</small>
        </article>
        <article className="merchant-growth-panel">
          <span>Шийдвэр хүлээж буй дүн</span>
          <strong>{growthMoney(wallet.reserved)}</strong>
          <small>Хүлээгдэж буй хүсэлтийн дүн дахин зарцуулагдахгүй.</small>
        </article>
        <article className="merchant-growth-panel">
          <Sparkles size={20} />
          <span>AI / 3D кредит</span>
          <strong>{growthCount(wallet.credits)}</strong>
          <small>Үйлчилгээний холболт бэлэн болоход ашиглана.</small>
        </article>
      </div>
      {error && (
        <p role="alert" className="merchant-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="merchant-success">
          {message}
        </p>
      )}
      {!verified || data.profile.bank_status !== "approved" ? (
        <div className="merchant-growth-callout">
          <span>Орлого татахын өмнө ААН болон дансаа баталгаажуулна уу.</span>
          <button type="button" onClick={onSetup}>
            Баталгаажуулалт руу <ArrowUpRight size={14} />
          </button>
        </div>
      ) : null}
      <div className="merchant-growth-form-grid">
        <form
          className="merchant-growth-panel"
          onSubmit={(event) => {
            event.preventDefault();
            void act(
              "withdrawal",
              String(new FormData(event.currentTarget).get("amount")),
            );
          }}
        >
          <h2>Орлого татах хүсэлт</h2>
          <p>
            {data.profile.bank_name || "Данс холбогдоогүй"} ·{" "}
            {data.profile.bank_account
              ? "••••" + data.profile.bank_account.slice(-4)
              : ""}
          </p>
          <label>
            Татах дүн (₮)
            <input
              name="amount"
              type="number"
              min="1"
              max={wallet.available}
              step="1"
              required
              disabled={busy || !canWithdraw}
            />
          </label>
          <button className="btn-primary" disabled={busy || !canWithdraw}>
            {busy ? "Боловсруулж байна…" : "Хүсэлт илгээх"}
          </button>
          <small>
            Автомат банкны холболт одоогоор идэвхгүй. Admin бодит шилжүүлгийн
            дугаараар хүсэлтийг хаана.
          </small>
        </form>
        <form
          className="merchant-growth-panel"
          onSubmit={(event) => {
            event.preventDefault();
            void act("credits", credits);
          }}
        >
          <h2>Хэтэвчээс кредит авах</h2>
          <p>
            {price > 0n
              ? `1 кредит = ${growthMoney(price.toString())}`
              : "Кредитийн үнийг admin тохируулсны дараа идэвхжинэ."}
          </p>
          <label>
            Кредитийн тоо
            <input
              type="number"
              min="1"
              max="1000000"
              step="1"
              value={credits}
              onChange={(event) => setCredits(event.target.value)}
              required
              disabled={busy || price === 0n}
            />
          </label>
          <strong>Нийт {growthMoney((quantity * price).toString())}</strong>
          <button
            className="btn-ghost"
            disabled={
              busy ||
              !verified ||
              price === 0n ||
              quantity < 1n ||
              quantity > 1000000n ||
              quantity * price > BigInt(wallet.available)
            }
          >
            Кредит авах
          </button>
        </form>
      </div>
      <div className="merchant-service-grid">
        {[
          ["Арын фон арилгах", data.settings.background_credits],
          ["Интерьер AI render", data.settings.render_credits],
          ["Зурагнаас 3D модел", data.settings.model_credits],
        ].map(([label, cost]) => (
          <article key={label} className="merchant-growth-panel">
            <Sparkles size={19} />
            <h3>{label}</h3>
            <strong>
              {Number(cost) > 0 ? `${cost} кредит` : "Үнэ тохируулаагүй"}
            </strong>
            <button type="button" className="btn-ghost" disabled>
              Холболтыг дараа идэвхжүүлнэ
            </button>
          </article>
        ))}
      </div>
      <section className="merchant-growth-panel">
        <h2>Хэтэвчийн хөдөлгөөн</h2>
        <ul className="merchant-growth-history">
          {data.transactions.map((item) => (
            <li key={item.id}>
              <div>
                <strong>
                  {item.kind === "withdrawal" ? "Орлого татах" : "Кредит авсан"}
                </strong>
                <small>
                  {new Date(item.created_at).toLocaleString("mn-MN", {
                    timeZone: "Asia/Ulaanbaatar",
                  })}
                  {item.review_note ? " · " + item.review_note : ""}
                </small>
              </div>
              <strong>
                {growthMoney(item.amount)}
                <small>{growthStatus(item.status)}</small>
              </strong>
            </li>
          ))}
        </ul>
        {!data.transactions.length && (
          <p>Хэтэвчийн хөдөлгөөн хараахан бүртгэгдээгүй.</p>
        )}
      </section>
      <section className="merchant-growth-panel">
        <h2>Кредитийн хөдөлгөөн</h2>
        <ul className="merchant-growth-history">
          {data.creditHistory.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.reason}</strong>
                <small>
                  {new Date(item.created_at).toLocaleDateString("mn-MN", {
                    timeZone: "Asia/Ulaanbaatar",
                  })}
                </small>
              </div>
              <strong>
                {BigInt(item.delta) > 0 ? "+" : ""}
                {growthCount(item.delta)} кредит
              </strong>
            </li>
          ))}
        </ul>
        {!data.creditHistory.length && (
          <p>Кредитийн хөдөлгөөн хараахан бүртгэгдээгүй.</p>
        )}
      </section>
    </section>
  );
}
