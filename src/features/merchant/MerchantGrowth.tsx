"use client";

import { useEffect, useState } from "react";
import {
  BadgeCheck,
  Check,
  Copy,
  Download,
  ExternalLink,
  Link2,
  Share2,
  Wallet,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import type { Store } from "@/lib/types";
import {
  growthCount,
  growthMoney,
  onboardingSteps,
  type MerchantGrowth as GrowthData,
} from "@/lib/merchantGrowth";
import { authFetch } from "@/lib/authFetch";
import { isOwner } from "./merchantApi";
import { useMerchantResource } from "./useMerchantResource";
import "./merchant-growth.css";

export function MerchantBalanceChip({
  owner,
  enabled,
  onOpen,
}: {
  owner: string;
  enabled: boolean;
  onOpen: () => void;
}) {
  const result = useMerchantResource<GrowthData>(
    owner,
    "/api/merchant/growth",
    enabled,
    60000,
  );
  const wallet = result.data?.wallet;
  return (
    <button
      type="button"
      className="merchant-balance-chip"
      onClick={onOpen}
      disabled={!enabled}
      title={
        result.error ??
        (wallet
          ? `Хэтэвч ${growthMoney(wallet.available)} · ${growthCount(wallet.credits)} кредит`
          : "Хэтэвч ачаалж байна")
      }
      aria-label="Хэтэвч ба AI / 3D кредит"
    >
      <span>
        <Wallet size={15} />
        <span>
          <small>Хэтэвч</small>
          <strong>
            {wallet
              ? growthMoney(wallet.available)
              : result.error
                ? "Алдаа"
                : "…"}
          </strong>
        </span>
      </span>
      <span>
        <Sparkles size={15} />
        <span>
          <small>AI / 3D</small>
          <strong>
            {wallet ? growthCount(wallet.credits) + " кредит" : "…"}
          </strong>
        </span>
      </span>
    </button>
  );
}

export function MerchantLaunchCard({
  owner,
  store,
  onSetup,
  onProducts,
  onStore,
}: {
  owner: string;
  store: Store | null;
  onSetup: () => void;
  onProducts: () => void;
  onStore: () => void;
}) {
  const result = useMerchantResource<GrowthData>(
    owner,
    "/api/merchant/growth",
    Boolean(store),
    60000,
  );
  const steps = onboardingSteps(result.data, store?.address);
  const done = steps.filter((step) => step.done).length;
  return (
    <section
      className="merchant-launch-card"
      aria-labelledby="merchant-launch-heading"
    >
      <header>
        <div>
          <span className="merchant-growth-eyebrow">ЭХЛЭХ АЛХМУУД</span>
          <h2 id="merchant-launch-heading">Шаардлагатай үйлдлүүд</h2>
          <p>Дэлгүүрээ борлуулалт хүлээн авахад бэлэн болгоорой.</p>
        </div>
        <strong>
          {done}
          <span> / {steps.length}</span>
        </strong>
      </header>
      <div
        role="progressbar"
        aria-label="Дэлгүүр идэвхжүүлэх явц"
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={done}
        className="merchant-launch-progress"
      >
        <span style={{ width: `${(done / 4) * 100}%` }} />
      </div>
      {store && result.error && (
        <p className="merchant-error" role="alert">
          Алхмын мэдээлэл ачаалагдсангүй.{" "}
          <button type="button" onClick={result.refresh}>
            Дахин оролдох
          </button>
        </p>
      )}
      <div className="merchant-launch-steps">
        {steps.map((step, index) => (
          <button
            type="button"
            key={step.id}
            className={step.done ? "is-done" : ""}
            onClick={
              !store || step.id === "showroom"
                ? onStore
                : step.id === "product"
                  ? onProducts
                  : onSetup
            }
          >
            <span className="merchant-launch-number">
              {step.done ? <Check size={15} /> : index + 1}
            </span>
            <span>
              <strong>{step.title}</strong>
              <small>
                {step.pending ? "Admin хянаж байна" : step.description}
              </small>
            </span>
            <ArrowUpRight size={15} />
          </button>
        ))}
      </div>
    </section>
  );
}

export function MerchantStoreShare({
  owner,
  store,
}: {
  owner: string;
  store: Store;
}) {
  const result = useMerchantResource<GrowthData>(
    owner,
    "/api/merchant/growth",
    true,
    60000,
  );
  const [origin, setOrigin] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);
  const key = result.data?.profile.slug || store.id;
  const path = `/store/${encodeURIComponent(key)}`;
  const shareOrigin =
    result.data?.shareOrigin || origin || "https://tavilga.mn";
  const url = `${shareOrigin}${path}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Холбоос хууллаа.");
    } catch {
      setMessage("Хуулж чадсангүй. Холбоосыг сонгож гараар хуулна уу.");
    }
  }
  return (
    <div className="merchant-store-share">
      {result.data?.profile.verification_status === "approved" && (
        <span className="merchant-verified">
          <BadgeCheck size={14} /> Verified Merchant
        </span>
      )}
      <div>
        <Link2 size={14} />
        <a href={url} target="_blank" rel="noreferrer">
          {shareOrigin.replace(/^https?:\/\//, "")}
          {path}
          <ExternalLink size={11} />
        </a>
      </div>
      <div className="merchant-share-actions">
        <button type="button" onClick={copy}>
          <Copy size={13} /> Хуулах
        </button>
        <button
          type="button"
          onClick={async () => {
            if (!navigator.share) {
              await copy();
              return;
            }
            try {
              await navigator.share({ title: store.name, url });
            } catch (error) {
              if (!(
                error instanceof DOMException && error.name === "AbortError"
              ))
                setMessage("Хуваалцаж чадсангүй.");
            }
          }}
        >
          <Share2 size={13} /> Хуваалцах
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setMessage("");
            try {
              const response = await authFetch(
                "/api/merchant/growth/qr",
                {},
                owner,
              );
              if (!response.ok) throw new Error("QR код үүсгэж чадсангүй.");
              const blob = await response.blob();
              if (!isOwner(owner)) return;
              const objectUrl = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = objectUrl;
              link.download = `${result.data?.profile.slug || "store"}-qr.png`;
              link.click();
              setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
              setMessage("QR код татлаа.");
            } catch (error) {
              setMessage(
                error instanceof Error ? error.message : "QR татаж чадсангүй.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <Download size={13} /> {busy ? "Бэлдэж байна…" : "QR татах"}
        </button>
      </div>
      {message && <small role="status">{message}</small>}
    </div>
  );
}
