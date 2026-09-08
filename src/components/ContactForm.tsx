"use client";
import { useRef, useState } from "react";
import { parseContact } from "@/lib/contact";

export function ContactForm() {
  const [fields, setFields] = useState({ name: "", email: "", message: "" });
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const inputClass = "input mt-1 !bg-transparent !text-white !border-white/30";
  return <form className="grid gap-3 rounded-lg border border-white/15 bg-white/5 p-6 sm:p-8" onSubmit={async event => {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(""); setSent(false);
    try {
      const body = parseContact(fields);
      const response = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Зурвас илгээж чадсангүй.");
      setSent(true); setFields({ name: "", email: "", message: "" });
    } catch (err) { setError(err instanceof Error ? err.message : "Холболтоо шалгаад дахин оролдоно уу."); }
    finally { pending.current = false; setBusy(false); }
  }}>
    <fieldset disabled={busy} className="grid gap-3">
      <label className="text-sm">Бүтэн нэр<input className={inputClass} autoComplete="name" required minLength={2} maxLength={100} value={fields.name} onChange={e => setFields({...fields, name: e.target.value})} /></label>
      <label className="text-sm">Имэйл<input className={inputClass} type="email" autoComplete="email" required maxLength={254} value={fields.email} onChange={e => setFields({...fields, email: e.target.value})} /></label>
      <label className="text-sm">Зурвас<textarea className={inputClass} rows={5} required minLength={10} maxLength={5000} value={fields.message} onChange={e => setFields({...fields, message: e.target.value})} /></label>
      <button type="submit" className="mt-2 min-h-11 rounded-lg bg-[#AD6547] px-6 py-3 text-sm font-medium disabled:opacity-50">{busy ? "Илгээж байна…" : "Илгээх"}</button>
    </fieldset>
    {error && <p role="alert" className="text-sm text-red-200">{error}</p>}
    {sent && <p role="status" className="text-sm text-green-200">Зурвасыг хүлээн авлаа. Бид таны имэйлээр холбогдоно.</p>}
  </form>;
}
