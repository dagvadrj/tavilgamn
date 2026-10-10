"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  RotateCcw,
  Settings,
  Store,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/store/auth";
import {
  DEFAULT_DASHBOARD_PREFERENCES,
  type DashboardPreferences,
} from "./preferences";

export function DashboardSettings({
  role,
  preferences,
  onChange,
  onStore,
}: {
  role: "admin" | "merchant";
  preferences: DashboardPreferences;
  onChange: (patch: Partial<DashboardPreferences>) => boolean;
  onStore?: () => void;
}) {
  const user = useAuth((state) => state.user);
  const [feedback, setFeedback] = useState<"saved" | "error" | null>(null);
  function change(patch: Partial<DashboardPreferences>) {
    setFeedback(onChange(patch) ? "saved" : "error");
  }
  return (
    <section
      className="dashboard-settings"
      aria-labelledby="dashboard-settings-heading"
    >
      <div className="dashboard-page-heading">
        <div>
          <span className="dashboard-eyebrow">УДИРДЛАГЫН САМБАР</span>
          <h1 id="dashboard-settings-heading">Тохиргоо</h1>
          <p>Самбарын харагдах байдал болон өөрийн бүртгэлээ удирдаарай.</p>
        </div>
        <span className="dashboard-heading-icon">
          <Settings size={24} />
        </span>
      </div>
      <div className="dashboard-settings-grid">
        <section
          className="dashboard-panel dashboard-settings-panel"
          aria-labelledby="dashboard-appearance-heading"
        >
          <h2 id="dashboard-appearance-heading">Харагдах байдал</h2>
          <p>
            Өөрчлөлт шууд хэрэгжинэ. Энэ төхөөрөмжийн хөтөч дээр таны бүртгэлээр
            хадгалагдана.
          </p>
          <fieldset className="dashboard-setting-group">
            <legend>Мэдээллийн зай</legend>
            <div className="dashboard-setting-options">
              {(
                [
                  [
                    "comfortable",
                    "Сул зайтай",
                    "Том товч, уншихад хялбар мөрүүд",
                  ],
                  ["compact", "Нягт", "Нэг дэлгэцэд илүү олон мэдээлэл"],
                ] as const
              ).map(([value, label, description]) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="dashboard-density"
                    value={value}
                    checked={preferences.density === value}
                    onChange={() => change({ density: value })}
                  />
                  <span>
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="dashboard-setting-group">
            <legend>Бичгийн хэмжээ</legend>
            <div className="dashboard-setting-options">
              {(
                [
                  ["standard", "Хэвийн"],
                  ["large", "Том"],
                ] as const
              ).map(([value, label]) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="dashboard-text-size"
                    value={value}
                    checked={preferences.textSize === value}
                    onChange={() => change({ textSize: value })}
                  />
                  <span>
                    <strong>{label}</strong>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {role === "merchant" && (
            <label className="dashboard-setting-select">
              <strong>Ерөнхий тоймд харах мэдээлэл</strong>
              <select
                value={preferences.overview}
                onChange={(event) =>
                  change({
                    overview: event.target
                      .value as DashboardPreferences["overview"],
                  })
                }
              >
                <option value="all">Борлуулалт ба нөөц</option>
                <option value="sales">Зөвхөн борлуулалт</option>
                <option value="inventory">Зөвхөн нөөц</option>
              </select>
            </label>
          )}
          <button
            type="button"
            className="dashboard-secondary-action"
            onClick={() => change(DEFAULT_DASHBOARD_PREFERENCES)}
          >
            <RotateCcw size={16} /> Анхны тохиргоо сэргээх
          </button>
          {feedback && (
            <p
              className={`dashboard-settings-feedback ${feedback === "error" ? "is-error" : ""}`}
              role={feedback === "error" ? "alert" : "status"}
            >
              {feedback === "saved"
                ? "Тохиргоо хадгалагдлаа."
                : "Тохиргоог хадгалж чадсангүй. Хөтчийн хадгалах зөвшөөрлийг шалгаарай."}
            </p>
          )}
        </section>
        <div className="dashboard-settings-details">
          <section className="dashboard-panel dashboard-settings-panel">
            <h2>
              <UserRound size={19} /> Миний бүртгэл
            </h2>
            <dl className="dashboard-account-details">
              <div>
                <dt>Нэр</dt>
                <dd>{user?.name}</dd>
              </div>
              <div>
                <dt>Имэйл</dt>
                <dd>{user?.email}</dd>
              </div>
              <div>
                <dt>Эрх</dt>
                <dd>{role === "admin" ? "Админ" : "Худалдаа эрхлэгч"}</dd>
              </div>
            </dl>
            <Link className="dashboard-secondary-action" href="/account">
              Бүртгэлээ нээх <ArrowUpRight size={16} />
            </Link>
          </section>
          {onStore && (
            <section className="dashboard-panel dashboard-settings-panel">
              <h2>
                <Store size={19} /> Дэлгүүрийн мэдээлэл
              </h2>
              <p>
                Дэлгүүрийн нэр, зураг, хаяг, утас болон барааны ангиллаа
                шинэчилнэ.
              </p>
              <button
                type="button"
                className="dashboard-secondary-action"
                onClick={onStore}
              >
                Дэлгүүрийн мэдээлэл засах <ArrowUpRight size={16} />
              </button>
            </section>
          )}
        </div>
      </div>
    </section>
  );
}
