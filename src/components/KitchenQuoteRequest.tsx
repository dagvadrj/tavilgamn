"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  LoaderCircle,
  MessageSquareQuote,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/authFetch";
import { useAuth } from "@/store/auth";

type RoomDefaults = { widthMm: number; depthMm: number; heightMm: number };

export function KitchenQuoteRequest({
  designId,
  returnPath,
  defaultRoom,
}: {
  designId: string;
  returnPath: string;
  defaultRoom: RoomDefaults;
}) {
  const router = useRouter();
  const user = useAuth((state) => state.user);
  const initialized = useAuth((state) => state.initialized);
  const initialize = useAuth((state) => state.initialize);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [phone, setPhone] = useState("");
  const idempotencyKey = useRef<string | null>(null);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const begin = () => {
    if (!initialized) return;
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(returnPath)}`);
      return;
    }
    setOpen(true);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || busy) return;
    const form = new FormData(event.currentTarget);
    idempotencyKey.current ??= crypto.randomUUID();
    setBusy(true);
    setError("");
    try {
      const response = await authFetch(
        `/api/kitchen-designs/${encodeURIComponent(designId)}/quotes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idempotencyKey: idempotencyKey.current,
            name: form.get("name"),
            phone: form.get("phone"),
            email: form.get("email"),
            roomWidthMm: Number(form.get("roomWidthMm")),
            roomDepthMm: Number(form.get("roomDepthMm")),
            roomHeightMm: Number(form.get("roomHeightMm")),
            message: form.get("message"),
          }),
        },
        user.id,
      );
      const body = await response.json().catch(() => null);
      if (!response.ok || typeof body?.quote?.id !== "string") {
        throw new Error(body?.error ?? "Үнийн хүсэлтийг илгээж чадсангүй.");
      }
      setSent(true);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Үнийн хүсэлтийг илгээж чадсангүй.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div
        className="rounded-2xl border border-[#42634f]/20 bg-[#eef4ef] p-4 text-sm text-[#293c32]"
        role="status"
      >
        <p className="flex items-center gap-2 font-medium">
          <CheckCircle2 size={17} />
          Хүсэлт амжилттай илгээгдлээ
        </p>
        <p className="mt-1 text-xs leading-5 text-black/55">
          Үйлдвэр хянаж, үнийн саналаа таны бүртгэлд илгээнэ.
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-[#293c32]/20 px-5 text-sm font-medium text-[#293c32] disabled:opacity-60"
        disabled={!initialized}
        onClick={begin}
      >
        <MessageSquareQuote size={17} />
        Үнийн санал авах
      </button>
    );
  }

  return (
    <form
      className="space-y-4 rounded-2xl border border-[#293c32]/15 bg-[#f8f8f4] p-4"
      onSubmit={submit}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-medium text-[#293c32]">Үнийн санал авах</h2>
          <p className="mt-1 text-xs text-black/50">
            Энэ загвар болон өрөөний хэмжээг үйлдвэрт илгээнэ.
          </p>
        </div>
        <button
          type="button"
          aria-label="Үнийн хүсэлтийн хэсгийг хаах"
          onClick={() => setOpen(false)}
        >
          <X size={18} />
        </button>
      </div>
      <fieldset className="space-y-3" disabled={busy}>
        <label className="block text-xs text-black/60">
          Нэр
          <input
            className="input mt-1 w-full"
            name="name"
            defaultValue={user?.name ?? ""}
            required
            minLength={2}
            maxLength={100}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <label className="block text-xs text-black/60">
            Утас
            <input
              className="input mt-1 w-full"
              name="phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
              minLength={4}
              maxLength={50}
              inputMode="tel"
              autoComplete="tel"
            />
          </label>
          <label className="block text-xs text-black/60">
            Имэйл
            <input
              className="input mt-1 w-full"
              name="email"
              defaultValue={user?.email ?? ""}
              required
              type="email"
              maxLength={254}
              autoComplete="email"
            />
          </label>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["roomWidthMm", "Өргөн", defaultRoom.widthMm],
              ["roomDepthMm", "Урт", defaultRoom.depthMm],
              ["roomHeightMm", "Өндөр", defaultRoom.heightMm],
            ] as const
          ).map(([name, label, value]) => (
            <label key={name} className="block text-xs text-black/60">
              {label} (мм)
              <input
                className="input mt-1 w-full px-2"
                name={name}
                type="number"
                required
                min={name === "roomHeightMm" ? 2000 : 1000}
                max={name === "roomHeightMm" ? 5000 : 20000}
                step={1}
                defaultValue={value}
              />
            </label>
          ))}
        </div>
        <label className="block text-xs text-black/60">
          Нэмэлт тайлбар
          <textarea
            className="input mt-1 min-h-24 w-full resize-y py-2"
            name="message"
            maxLength={3000}
            placeholder="Материал, өнгө, хүргэлт зэрэг хүсэлтээ бичнэ үү."
          />
        </label>
        <button className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#293c32] px-5 text-sm font-medium text-white disabled:cursor-wait disabled:opacity-60">
          {busy ? (
            <LoaderCircle className="animate-spin" size={16} />
          ) : (
            <MessageSquareQuote size={16} />
          )}
          {busy ? "Илгээж байна…" : "Хүсэлт илгээх"}
        </button>
      </fieldset>
      {error ? (
        <p className="text-xs leading-5 text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
