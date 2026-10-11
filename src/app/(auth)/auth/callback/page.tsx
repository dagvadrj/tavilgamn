"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { AuthFrame } from "@/features/auth/AuthFrame";
import { authErrorMessage } from "@/lib/authErrors";
import {
  finishAuthDestination,
  rememberAuthDestination,
} from "@/lib/authRedirect";
import { useAuth } from "@/store/auth";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [next, setNext] = useState("/account");
  useEffect(() => {
    let active = true;
    const destination = rememberAuthDestination(window.location.search);
    setNext(destination);
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (params.has("error") || hash.has("error")) {
      setError(
        (params.get("error") ?? hash.get("error")) === "access_denied"
          ? "Нэвтрэх хүсэлтийг цуцаллаа. Өөр аргаар нэвтрэх эсвэл дахин оролдоно уу."
          : "Нэвтрэлтийг баталгаажуулж чадсангүй. Дахин оролдоно уу.",
      );
      window.history.replaceState(
        window.history.state,
        "",
        `/auth/callback?next=${encodeURIComponent(destination)}`,
      );
      return;
    }
    // The existing browser Supabase client detects and saves the OAuth session.
    // Await the same initialization as AuthBootstrap before reading the DB role.
    void useAuth
      .getState()
      .initialize()
      .then(() => {
        if (!active) return;
        const auth = useAuth.getState();
        if (!auth.user) {
          setError(
            "Нэвтрэлтийн холбоос хүчингүй эсвэл хугацаа нь дууссан байна. Дахин нэвтэрнэ үү.",
          );
          return;
        }
        router.replace(finishAuthDestination(auth.role));
        router.refresh();
      })
      .catch((reason) => {
        if (active) setError(authErrorMessage(reason, "signIn"));
      });
    return () => {
      active = false;
    };
  }, [router]);
  return (
    <AuthFrame destination={next}>
      <div className="auth-callback" role={error ? "alert" : "status"}>
        {error ? (
          <>
            <h1>Нэвтэрч чадсангүй</h1>
            <p>{error}</p>
            <Link
              className="auth-submit"
              href={`/login?next=${encodeURIComponent(next)}`}
            >
              Нэвтрэх хуудас руу буцах
            </Link>
          </>
        ) : (
          <>
            <LoaderCircle className="auth-spinner" size={32} />
            <h1>Нэвтрэлтийг шалгаж байна…</h1>
            <p>Таны бүртгэлийг нээгээд тохирох хэсэг рүү шилжүүлнэ.</p>
          </>
        )}
      </div>
    </AuthFrame>
  );
}
