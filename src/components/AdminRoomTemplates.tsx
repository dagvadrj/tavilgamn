"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Plus, PencilRuler } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import type { RoomTemplateCard } from "@/lib/roomTemplates";
import { ROOM_TYPES } from "@/lib/roomGeometry";
import "@/features/room-planner/components/room-templates.css";

export function AdminRoomTemplates({ owner }: { owner: string }) {
  const [items, setItems] = useState<RoomTemplateCard[] | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState("all");
  useEffect(() => {
    const controller = new AbortController();
    setItems(null);
    setError("");
    void authFetch(
      "/api/admin/room-templates",
      { signal: controller.signal },
      owner,
    )
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (!controller.signal.aborted) setItems(data.templates);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => controller.abort();
  }, [owner, attempt]);
  const visible =
    items?.filter((item) => filter === "all" || item.status === filter) ?? [];
  return (
    <section className="room-template-library">
      <div className="admin-section-heading">
        <div>
          <span className="admin-eyebrow">ӨРӨӨНИЙ ТӨЛӨВЛӨГЧ</span>
          <h1>Бэлэн өрөөнүүд</h1>
          <p>
            Хоосон өрөө, тавилгатай зохиомжоо planner дээр бэлдэж нийтлээрэй.
          </p>
        </div>
        <Link className="admin-btn-primary" href="/planner?roomTemplate=new">
          <Plus size={18} /> Өрөө нэмэх
        </Link>
      </div>
      <div className="room-template-filters">
        <div>
          {[
            ["all", "Бүгд"],
            ["published", "Нийтэлсэн"],
            ["draft", "Ноорог"],
            ["archived", "Архив"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
            >
              {label}{" "}
              {items &&
                `(${items.filter((item) => id === "all" || item.status === id).length})`}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>
          Шинэчлэх
        </button>
      </div>
      {error && (
        <p className="room-template-message" role="alert">
          {error}{" "}
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Дахин оролдох
          </button>
        </p>
      )}
      {!items && !error && <p role="status">Өрөөнүүдийг ачаалж байна…</p>}
      <div className="room-template-grid">
        {visible.map((item) => (
          <Link
            className="room-template-card"
            href={`/planner?roomTemplate=${item.id}`}
            key={item.id}
          >
            <span className="room-template-image">
              {item.previewImage ? (
                <Image
                  unoptimized
                  src={item.previewImage}
                  width={768}
                  height={480}
                  alt={item.title}
                />
              ) : (
                <PencilRuler size={42} />
              )}
            </span>
            <span className="room-template-copy">
              <strong>{item.title}</strong>
              <small>
                {item.area.toFixed(1)} м² · {ROOM_TYPES[item.roomType].label} ·{" "}
                {item.kind === "empty" ? "Хоосон" : "Тавилгатай"}
              </small>
              <small>
                {item.status === "published"
                  ? "Нийтэлсэн"
                  : item.status === "archived"
                    ? "Архивласан"
                    : "Ноорог"}{" "}
                · Засах →
              </small>
            </span>
          </Link>
        ))}
      </div>
      {items && !visible.length && (
        <p className="room-template-empty">
          Энд хараахан өрөө алга. “Өрөө нэмэх” дарж 3D planner дээр зохиомжоо
          бэлдэнэ үү.
        </p>
      )}
    </section>
  );
}
