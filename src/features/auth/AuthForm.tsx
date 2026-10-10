"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  MailCheck,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/store/auth";
import { authErrorMessage } from "@/lib/authErrors";
import {
  finishAuthDestination,
  rememberAuthDestination,
} from "@/lib/authRedirect";
import { AuthFrame } from "./AuthFrame";
import { SocialButtons } from "./SocialButtons";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const register = mode === "register";
  const router = useRouter();
  const signIn = useAuth((s) => s.signIn);
  const signUp = useAuth((s) => s.signUp);
  const signInWithProvider = useAuth((s) => s.signInWithProvider);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState<"email" | "google" | "apple" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState(false);
  const [next, setNext] = useState("/account");
  const busy = useRef(false);
  useEffect(() => {
    setNext(rememberAuthDestination(window.location.search));
  }, []);

  const complete = () => {
    router.replace(finishAuthDestination(useAuth.getState().role));
    router.refresh();
  };
  const socialSignIn = async (provider: "google" | "apple") => {
    if (busy.current || confirmation) return;
    busy.current = true;
    setPending(provider);
    setError(null);
    try {
      const result = await signInWithProvider(provider);
      if (result.error) {
        setError(result.error);
        busy.current = false;
        setPending(null);
      }
      // Keep all controls locked until the successful provider redirect.
    } catch (reason) {
      setError(authErrorMessage(reason, "signIn"));
      busy.current = false;
      setPending(null);
    }
  };

  return (
    <AuthFrame destination={next}>
      <div className="auth-form-heading">
        <p className="auth-eyebrow">
          {register ? "ШИНЭ БҮРТГЭЛ" : "ТАВТАЙ МОРИЛНО УУ"}
        </p>
        <h1>{register ? "Бүртгэл үүсгэх" : "Бүртгэлдээ нэвтрэх"}</h1>
        <p>
          {register
            ? "Бүртгэлээ үүсгээд өөрийн загвар, сонголтуудаа хадгалаарай."
            : "Өөрт тохирох аргаар нэвтрээд үргэлжлүүлээрэй."}
        </p>
      </div>
      {confirmation ? (
        <div className="auth-confirmation" role="status">
          <MailCheck size={34} />
          <h2>Имэйлээ шалгаарай</h2>
          <p>
            <strong>{email.trim()}</strong> хаяг руу баталгаажуулах холбоос
            илгээлээ. Холбоосыг нээгээд нэвтэрнэ үү.
          </p>
          <Link
            className="auth-submit"
            href={`/login?next=${encodeURIComponent(next)}`}
          >
            Нэвтрэх хуудас руу <ArrowRight size={18} />
          </Link>
        </div>
      ) : (
        <>
          <SocialButtons
            disabled={pending !== null}
            pending={pending}
            onSignIn={socialSignIn}
          />
          <div className="auth-divider">
            <span>эсвэл имэйлээр</span>
          </div>
          <form
            className="auth-form"
            aria-busy={pending !== null}
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy.current) return;
              if (
                register &&
                (name.trim().length < 2 || name.trim().length > 100)
              ) {
                setError("Нэрээ 2–100 тэмдэгтээр оруулна уу.");
                return;
              }
              if (register && password.length < 8) {
                setError("Нууц үг хамгийн багадаа 8 тэмдэгт байна.");
                return;
              }
              busy.current = true;
              setPending("email");
              setError(null);
              try {
                const result = register
                  ? await signUp(name.trim(), email.trim(), password)
                  : await signIn(email.trim(), password);
                if (result.error) {
                  setError(result.error);
                  return;
                }
                if (result.needsEmailConfirmation) {
                  setConfirmation(true);
                  return;
                }
                complete();
              } catch (reason) {
                setError(
                  authErrorMessage(reason, register ? "signUp" : "signIn"),
                );
              } finally {
                busy.current = false;
                setPending(null);
              }
            }}
          >
            {register && (
              <div className="auth-field">
                <label htmlFor="auth-name">Бүтэн нэр</label>
                <input
                  id="auth-name"
                  name="name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                  maxLength={100}
                  disabled={pending !== null}
                  placeholder="Таны нэр"
                />
              </div>
            )}
            <div className="auth-field">
              <label htmlFor="auth-email">Имэйл хаяг</label>
              <input
                type="email"
                id="auth-email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={pending !== null}
                placeholder="name@example.com"
              />
            </div>
            <div className="auth-field">
              <label htmlFor="auth-password">Нууц үг</label>
              <div className="auth-password-field">
                <input
                  type={showPassword ? "text" : "password"}
                  id="auth-password"
                  name="password"
                  autoComplete={register ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={register ? 8 : undefined}
                  disabled={pending !== null}
                  placeholder={
                    register
                      ? "Хамгийн багадаа 8 тэмдэгт"
                      : "Нууц үгээ оруулна уу"
                  }
                  aria-describedby={register ? "auth-password-help" : undefined}
                />
                <button
                  type="button"
                  disabled={pending !== null}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Нууц үг нуух" : "Нууц үг харах"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
              {register && (
                <small id="auth-password-help">
                  Том, жижиг үсэг болон тоо хослуулбал илүү найдвартай.
                </small>
              )}
            </div>
            {error && (
              <p role="alert" className="auth-error">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={pending !== null}
              className="auth-submit"
            >
              {pending === "email" ? (
                <>
                  <LoaderCircle size={18} className="auth-spinner" />{" "}
                  {register ? "Бүртгэж байна…" : "Нэвтэрч байна…"}
                </>
              ) : (
                <>
                  {register ? "Бүртгүүлэх" : "Нэвтрэх"}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
          <p className="auth-switch">
            {register ? "Бүртгэлтэй юу?" : "Шинэ хэрэглэгч үү?"}{" "}
            <Link
              href={`/${register ? "login" : "register"}?next=${encodeURIComponent(next)}`}
            >
              {register ? "Нэвтрэх" : "Бүртгүүлэх"}
            </Link>
          </p>
          <p className="auth-security">
            <ShieldCheck size={16} /> Нэвтрэх мэдээлэл тань хамгаалагдана.
          </p>
        </>
      )}
    </AuthFrame>
  );
}
