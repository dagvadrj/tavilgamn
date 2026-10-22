"use client";
import { useState } from "react";
import { FileCheck2, Link2, Landmark, MapPin, Send } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { type MerchantGrowth } from "@/lib/merchantGrowth";
import { isOwner, merchantRequest } from "./merchantApi";
import { useMerchantResource } from "./useMerchantResource";
import { StatSkeleton } from "./MerchantStats";
import "./merchant-growth.css";

export const growthStatus = (value?: string) =>
  ({
    approved: "Баталгаажсан",
    pending: "Хянаж байна",
    rejected: "Буцаасан",
    unsubmitted: "Мэдээлэл оруулаагүй",
    paid: "Шилжүүлсэн",
    completed: "Дууссан",
    accepted: "Файл хүлээн авсан",
  })[value ?? ""] ??
  value ??
  "Мэдээлэл оруулаагүй";

export function MerchantActivation({
  owner,
  onStore,
}: {
  owner: string;
  onStore: () => void;
}) {
  const resource = useMerchantResource<MerchantGrowth>(
    owner,
    "/api/merchant/growth",
  );
  if (!resource.data)
    return resource.error ? (
      <p className="merchant-error" role="alert">
        {resource.error}
        <button onClick={resource.refresh}>Дахин оролдох</button>
      </p>
    ) : (
      <StatSkeleton rows={5} />
    );
  return (
    <ActivationForms
      key={`${resource.data.profile.verification_version}-${resource.data.profile.bank_version}-${resource.data.profile.slug}`}
      owner={owner}
      data={resource.data}
      refresh={resource.refresh}
      onStore={onStore}
    />
  );
}
function ActivationForms({
  owner,
  data,
  refresh,
  onStore,
}: {
  owner: string;
  data: MerchantGrowth;
  refresh: () => void;
  onStore: () => void;
}) {
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const profile = data.profile;
  async function submit(action: string, form: FormData) {
    if (busy) return;
    setBusy(action);
    setError("");
    setMessage("");
    try {
      if (action === "certificate") {
        form.set("kind", "certificate");
        const response = await authFetch(
          "/api/merchant/growth/files",
          { method: "POST", body: form },
          owner,
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Файл илгээгээгүй.");
        if (!isOwner(owner)) return;
      } else {
        await merchantRequest("/api/merchant/growth", owner, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...Object.fromEntries(form) }),
        });
      }
      window.dispatchEvent(
        new CustomEvent("merchant-data-changed", { detail: owner }),
      );
      refresh();
      setMessage("Мэдээллийг хадгаллаа.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Хадгалж чадсангүй.");
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="merchant-growth-page">
      <header>
        <span className="merchant-growth-eyebrow">ДЭЛГҮҮР ИДЭВХЖҮҮЛЭХ</span>
        <h1>Дэлгүүрээ бэлэн болгоё</h1>
        <p>
          Гэрчилгээ болон дансны мэдээлэл зөвхөн таны дэлгүүр ба эрх бүхий
          admin-д харагдана.
        </p>
      </header>
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
      <div className="merchant-growth-form-grid">
        <form
          className="merchant-growth-panel"
          onSubmit={(event) => {
            event.preventDefault();
            void submit("certificate", new FormData(event.currentTarget));
          }}
        >
          <header>
            <FileCheck2 size={22} />
            <h2>ААН-ийн гэрчилгээ</h2>
            <span className="merchant-growth-status">
              {growthStatus(profile.verification_status)}
            </span>
          </header>
          <p>
            Admin гэрчилгээг шалгаж баталгаажуулсны дараа Verified Merchant
            тэмдэг идэвхжинэ.
          </p>
          {profile.review_note && (
            <p className="merchant-growth-review">{profile.review_note}</p>
          )}
          <fieldset disabled={Boolean(busy)}>
            <label>
              ААН-ийн нэр
              <input
                name="legalName"
                required
                minLength={2}
                maxLength={200}
                defaultValue={profile.legal_name}
              />
            </label>
            <label>
              Регистрийн дугаар
              <input
                name="registrationNo"
                required
                minLength={4}
                maxLength={40}
                defaultValue={profile.registration_no}
              />
            </label>
            <label>
              Гэрчилгээний файл
              <input
                type="file"
                name="file"
                accept="application/pdf,image/jpeg,image/png"
                required
              />
              <small>PDF, JPG, PNG · 10 MB хүртэл</small>
            </label>
            <button type="submit" className="btn-primary">
              <Send size={15} />
              {busy === "certificate" ? "Илгээж байна…" : "Хяналтад илгээх"}
            </button>
          </fieldset>
        </form>
        <form
          className="merchant-growth-panel"
          onSubmit={(event) => {
            event.preventDefault();
            void submit("bank", new FormData(event.currentTarget));
          }}
        >
          <header>
            <Landmark size={22} />
            <h2>Орлого хүлээн авах данс</h2>
            <span className="merchant-growth-status">
              {growthStatus(profile.bank_status)}
            </span>
          </header>
          <p>
            Дансны эзэмшигчийн нэр нь баталгаажуулсан ААН эсвэл эрх бүхий
            эзэмшигчтэй таарна.
          </p>
          {profile.bank_note && (
            <p className="merchant-growth-review">{profile.bank_note}</p>
          )}
          <fieldset disabled={Boolean(busy)}>
            <label>
              Банкны нэр
              <input
                name="bankName"
                required
                minLength={2}
                maxLength={100}
                defaultValue={profile.bank_name}
              />
            </label>
            <label>
              Данс / IBAN
              <input
                name="account"
                required
                minLength={8}
                maxLength={50}
                defaultValue={profile.bank_account}
                autoComplete="off"
              />
            </label>
            <label>
              Данс эзэмшигч
              <input
                name="holder"
                required
                minLength={2}
                maxLength={200}
                defaultValue={profile.bank_holder}
              />
            </label>
            <button type="submit" className="btn-primary">
              <Send size={15} />
              {busy === "bank" ? "Хадгалж байна…" : "Данс баталгаажуулах"}
            </button>
          </fieldset>
          <small>
            Автомат банкны шилжүүлгийн холболтыг дараа идэвхжүүлнэ. Одоогоор
            орлого татах хүсэлтийг admin шийдвэрлэнэ.
          </small>
        </form>
        <form
          className="merchant-growth-panel"
          onSubmit={(event) => {
            event.preventDefault();
            void submit("slug", new FormData(event.currentTarget));
          }}
        >
          <header>
            <Link2 size={21} />
            <h2>Дэлгүүрийн шууд холбоос</h2>
          </header>
          <p>Facebook болон QR кодод ашиглах дэлгүүрийн богино нэр.</p>
          <fieldset disabled={Boolean(busy)}>
            <label>
              tavilga.mn/store/
              <input
                name="slug"
                required
                minLength={3}
                maxLength={40}
                pattern="[a-z0-9][a-z0-9-]{2,39}"
                placeholder="nqc"
                defaultValue={profile.slug ?? ""}
              />
              <small>3–40 латин жижиг үсэг, тоо, зураас.</small>
            </label>
            <button type="submit" className="btn-ghost">
              Холбоос хадгалах
            </button>
          </fieldset>
        </form>
        <section className="merchant-growth-panel">
          <header>
            <MapPin size={21} />
            <h2>Шоурум / салбар</h2>
          </header>
          <p>
            Хэрэглэгч ирж үзэх биет дэлгүүрийн хаяг болон утсаа шинэчлээрэй.
          </p>
          <button type="button" className="btn-ghost" onClick={onStore}>
            Хаяг, дэлгүүрийн мэдээлэл засах
          </button>
        </section>
      </div>
    </section>
  );
}
