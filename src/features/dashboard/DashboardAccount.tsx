"use client";

import { useRef, useState } from "react";
import { LogOut, Save, ShieldCheck, Store, UserRound } from "lucide-react";
import { useAuth } from "@/store/auth";

export function DashboardAccount({
  role,
  onStore,
}: {
  role: "merchant" | "admin";
  onStore?: () => void;
}) {
  const user = useAuth((s) => s.user);
  const updateName = useAuth((s) => s.updateName);
  const signOut = useAuth((s) => s.signOut);
  const [name, setName] = useState(user?.name ?? "");
  const [pending, setPending] = useState<"save" | "logout" | null>(null);
  const [feedback, setFeedback] = useState<{
    error: boolean;
    message: string;
  } | null>(null);
  const busy = useRef(false);

  return (
    <section
      className="dashboard-settings dashboard-profile"
      aria-labelledby="dashboard-profile-heading"
    >
      <div className="dashboard-page-heading">
        <div>
          <span className="dashboard-eyebrow">
            {role === "merchant"
              ? "ХУДАЛДАА ЭРХЛЭГЧИЙН БҮРТГЭЛ"
              : "АДМИНЫ БҮРТГЭЛ"}
          </span>
          <h1 id="dashboard-profile-heading">Миний бүртгэл</h1>
          <p>Удирдлагын бүртгэл болон хувийн мэдээллээ эндээс шинэчлээрэй.</p>
        </div>
        <span className="dashboard-heading-icon">
          <UserRound size={24} />
        </span>
      </div>
      <div className="dashboard-settings-grid">
        <section className="dashboard-panel dashboard-settings-panel">
          <div className="dashboard-profile-identity">
            <span className="dashboard-profile-avatar">
              {user?.name.trim().slice(0, 1).toUpperCase() || "U"}
            </span>
            <div>
              <h2>{user?.name}</h2>
              <p>{role === "merchant" ? "Худалдаа эрхлэгч" : "Админ"}</p>
            </div>
          </div>
          <form
            className="dashboard-profile-form"
            aria-busy={pending !== null}
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy.current) return;
              busy.current = true;
              setPending("save");
              setFeedback(null);
              try {
                const result = await updateName(name);
                setFeedback({
                  error: Boolean(result.error),
                  message: result.error ?? "Таны нэр шинэчлэгдлээ.",
                });
              } catch {
                setFeedback({
                  error: true,
                  message: "Нэрийг хадгалж чадсангүй. Дахин оролдоно уу.",
                });
              } finally {
                busy.current = false;
                setPending(null);
              }
            }}
          >
            <label htmlFor="dashboard-profile-name">
              Бүтэн нэр
              <input
                id="dashboard-profile-name"
                name="name"
                autoComplete="name"
                minLength={2}
                maxLength={100}
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={pending !== null}
                required
              />
            </label>
            <div className="dashboard-profile-email">
              <span>Имэйл хаяг</span>
              <strong>{user?.email}</strong>
              <small>Таны нэвтрэх бүртгэлийн имэйл.</small>
            </div>
            {feedback && (
              <p
                className={`dashboard-settings-feedback ${feedback.error ? "is-error" : ""}`}
                role={feedback.error ? "alert" : "status"}
              >
                {feedback.message}
              </p>
            )}
            <button
              type="submit"
              className="dashboard-secondary-action"
              disabled={pending !== null || name.trim() === user?.name}
            >
              <Save size={17} />{" "}
              {pending === "save" ? "Хадгалж байна…" : "Өөрчлөлт хадгалах"}
            </button>
          </form>
        </section>
        <div className="dashboard-settings-details">
          <section className="dashboard-panel dashboard-settings-panel">
            <h2>
              <ShieldCheck size={20} /> Нэвтрэх эрх
            </h2>
            <p>
              Таны эрх:{" "}
              <strong>
                {role === "merchant" ? "Худалдаа эрхлэгч" : "Админ"}
              </strong>
              . Удирдлагын эрхийг админ хянадаг.
            </p>
            <button
              type="button"
              className="dashboard-secondary-action"
              disabled={pending !== null}
              onClick={async () => {
                if (busy.current) return;
                busy.current = true;
                setPending("logout");
                setFeedback(null);
                try {
                  await signOut();
                  window.location.replace(`/login?next=/${role}`);
                } catch {
                  setFeedback({
                    error: true,
                    message: "Бүртгэлээс гарч чадсангүй. Дахин оролдоно уу.",
                  });
                } finally {
                  busy.current = false;
                  setPending(null);
                }
              }}
            >
              <LogOut size={17} />{" "}
              {pending === "logout" ? "Гарч байна…" : "Бүртгэлээс гарах"}
            </button>
          </section>
          {onStore && (
            <section className="dashboard-panel dashboard-settings-panel">
              <h2>
                <Store size={20} /> Дэлгүүрийн мэдээлэл
              </h2>
              <p>
                Дэлгүүрийн нэр, холбоо барих мэдээлэл болон зургийг тусдаа
                хэсэгт засна.
              </p>
              <button
                type="button"
                className="dashboard-secondary-action"
                onClick={onStore}
              >
                Дэлгүүрийн мэдээлэл засах
              </button>
            </section>
          )}
        </div>
      </div>
    </section>
  );
}
