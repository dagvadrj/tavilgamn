import { LoaderCircle } from "lucide-react";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.23c1.9-1.75 2.99-4.33 2.99-7.36Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.9 6.61-2.41l-3.23-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.08v2.59A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.41 13.92a6 6 0 0 1 0-3.84V7.49H3.08a10 10 0 0 0 0 9.02l3.33-2.59Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.96c1.47 0 2.79.5 3.82 1.5l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.92 5.49l3.33 2.59C7.2 7.72 9.4 5.96 12 5.96Z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="21"
      height="21"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M17.1 12.3c0-2 1.64-3 1.71-3.05-.94-1.4-2.4-1.6-2.92-1.61-1.24-.13-2.44.74-3.08.74-.65 0-1.63-.72-2.68-.7-1.38.02-2.68.82-3.39 2.06-1.47 2.53-.37 6.25 1.04 8.3.7 1 1.52 2.11 2.6 2.07 1.03-.04 1.43-.66 2.69-.66 1.25 0 1.62.66 2.72.63 1.13-.02 1.84-1 2.51-2.01.81-1.15 1.13-2.3 1.15-2.35-.03-.01-2.34-.9-2.35-3.42ZM15.04 6.29c.56-.71.95-1.68.84-2.66-.81.04-1.81.56-2.4 1.25-.51.6-.99 1.62-.87 2.56.91.06 1.85-.46 2.43-1.15Z" />
    </svg>
  );
}

export function SocialButtons({
  disabled,
  pending,
  onSignIn,
}: {
  disabled: boolean;
  pending: "google" | "apple" | "email" | null;
  onSignIn: (provider: "google" | "apple") => void;
}) {
  return (
    <div className="auth-social-buttons">
      {(["google", "apple"] as const).map((provider) => (
        <button
          key={provider}
          type="button"
          disabled={disabled}
          className={`auth-social-button auth-social-${provider}`}
          onClick={() => onSignIn(provider)}
        >
          {pending === provider ? (
            <LoaderCircle size={20} className="auth-spinner" />
          ) : provider === "google" ? (
            <GoogleIcon />
          ) : (
            <AppleIcon />
          )}
          {provider === "google"
            ? "Google-ээр үргэлжлүүлэх"
            : "Apple-аар үргэлжлүүлэх"}
        </button>
      ))}
    </div>
  );
}
