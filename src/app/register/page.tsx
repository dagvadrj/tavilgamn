"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/store/auth";

import { finishAuthDestination, rememberAuthDestination } from "@/lib/authRedirect";
import { authErrorMessage } from "@/lib/authErrors";

export default function RegisterPage() {
  const router = useRouter();
  const signUp = useAuth((state) => state.signUp);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [next, setNext] = useState("/account");
  const pending = useRef(false);
  useEffect(() => { setNext(rememberAuthDestination(window.location.search)); }, []);

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <p className="label mb-2">Бүртгэл үүсгэх</p>
        <h1 className="text-3xl font-semibold tracking-tight">Таны гэрийн шинэ эхлэл</h1>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (pending.current) return;
            if (name.trim().length < 2) { setError("Нэрээ хамгийн багадаа 2 тэмдэгтээр оруулна уу."); return; }

            if (password.length < 8) {
              setError("Нууц үг хамгийн багадаа 8 тэмдэгт байна.");
              return;
            }

            setSubmitting(true);
            pending.current = true;
            setError(null);
            setMessage(null);

            try {
              const result = await signUp(name.trim(), email.trim(), password);

              if (result.error) {
                setError(result.error);
                setSubmitting(false);
                return;
              }

              if (result.needsEmailConfirmation) {
                setMessage(
                  "Бүртгэл үүслээ. Имэйлээр ирсэн баталгаажуулах холбоосыг нээнэ үү.",
                );
                setSubmitting(false);
                return;
              }

              router.replace(finishAuthDestination());
              router.refresh();
            } catch (error) {
              setError(authErrorMessage(error, "signUp"));
            } finally {
              pending.current = false;
              setSubmitting(false);
            }
          }}
          className="mt-8 space-y-4"
        >
          <div>
            <label htmlFor="register-name" className="label mb-2 block">Бүтэн нэр</label>
            <input
              id="register-name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="input"
            />
          </div>
          <div>
            <label htmlFor="register-email" className="label mb-2 block">Имэйл</label>
            <input
              type="email"
              id="register-email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input"
            />
          </div>
          <div>
            <label htmlFor="register-password" className="label mb-2 block">Нууц үг</label>
            <input
              type="password"
              id="register-password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input"
            />
          </div>
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}

          {message && (
            <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
              {message}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting || Boolean(message)}
            className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Бүртгэж байна…" : "Бүртгүүлэх"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-ink/60">
          Бүртгэлтэй юу?{" "}
          <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-ink underline">
            Нэвтрэх
          </Link>
        </p>
      </div>
    </div>
  );
}
