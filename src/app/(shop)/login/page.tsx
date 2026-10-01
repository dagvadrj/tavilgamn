"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/store/auth";

import { finishAuthDestination, rememberAuthDestination } from "@/lib/authRedirect";
import { authErrorMessage } from "@/lib/authErrors";

export default function LoginPage() {
  const router = useRouter();
  const signIn = useAuth((s) => s.signIn);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [next, setNext] = useState("/account");
  useEffect(() => { setNext(rememberAuthDestination(window.location.search)); }, []);

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <p className="label mb-2">Тавтай морилно уу</p>
        <h1 className="text-3xl font-semibold tracking-tight">Тавтай морилно уу</h1>
        <p className="mt-3 text-sm leading-6 text-[#6c726b]">Хадгалсан тавилга, захиалга, өрөөний загвараа нэг дороос.</p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();

            setSubmitting(true);
            setError(null);

            try {
              const result = await signIn(email.trim(), password);
              if (result.error) {
                setError(result.error);
                return;
              }
              router.replace(finishAuthDestination());
              router.refresh();
            } catch (error) {
              setError(authErrorMessage(error, "signIn"));
            } finally {
              setSubmitting(false);
            }
          }}
          className="mt-8 space-y-4"
        >
          <div>
            <label htmlFor="login-email" className="label mb-2 block">Имэйл</label>
            <input
              type="email"
              id="login-email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input"
              placeholder="та@жишээ.com"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="label mb-2 block">Нууц үг</label>
            <input
              type="password"
              id="login-password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input"
              placeholder="••••••••"
            />
          </div>
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Нэвтэрч байна…" : "Нэвтрэх"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-ink/60">
          tavilga.mn-д шинээр бүртгүүлэх үү?{" "}
          <Link href={`/register?next=${encodeURIComponent(next)}`} className="text-ink underline">
            Бүртгүүлэх
          </Link>
        </p>
      </div>
    </div>
  );
}
