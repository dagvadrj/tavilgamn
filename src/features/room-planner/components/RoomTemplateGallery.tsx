"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowRight, PencilRuler } from "lucide-react";
import type { RoomDesign, RoomType } from "@/lib/types";
import type { RoomTemplate, RoomTemplateCard } from "@/lib/roomTemplates";
import { ROOM_TYPES } from "@/lib/roomGeometry";
import "./room-templates.css";

export function RoomTemplateGallery({
  onBuild,
  onTemplate,
}: {
  onBuild: (type: RoomType) => void;
  onTemplate: (design: RoomDesign) => void;
}) {
  const [type, setType] = useState<RoomType>("living");
  const [templates, setTemplates] = useState<RoomTemplateCard[] | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [opening, setOpening] = useState<string | null>(null);
  const [filter, setFilter] = useState<RoomType | "all">("all");
  const [furnishing, setFurnishing] = useState("all");
  const [expanded, setExpanded] = useState(false);
  const openRequest = useRef<AbortController | null>(null);
  useEffect(() => () => openRequest.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    setTemplates(null);
    void fetch("/api/room-templates", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (!controller.signal.aborted) setTemplates(data.templates);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => controller.abort();
  }, [attempt]);
  async function open(id: string) {
    if (opening) return;
    const controller = new AbortController();
    openRequest.current = controller;
    setOpening(id);
    setError("");
    try {
      const response = await fetch(`/api/room-templates?id=${id}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const data = (await response.json()) as {
        template: RoomTemplate;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error);
      if (!controller.signal.aborted) onTemplate(data.template.design);
    } catch (error) {
      if (!controller.signal.aborted)
        setError(
          error instanceof Error ? error.message : "Өрөөг нээж чадсангүй.",
        );
    } finally {
      if (!controller.signal.aborted) setOpening(null);
    }
  }
  const empty = templates?.filter((item) => item.kind === "empty") ?? [];
  const furnished =
    templates?.filter(
      (item) =>
        item.kind === "furnished" &&
        (filter === "all" || item.roomType === filter) &&
        (furnishing === "all" || item.furnishing === furnishing),
    ) ?? [];
  const cards = (items: RoomTemplateCard[]) => (
    <div className="room-template-grid">
      {items.map((item) => (
        <button
          type="button"
          className="room-template-card"
          key={item.id}
          disabled={opening !== null}
          onClick={() => void open(item.id)}
        >
          <span className="room-template-image">
            <Image
              unoptimized
              src={item.previewImage}
              width={768}
              height={480}
              alt={item.title}
            />
          </span>
          <span className="room-template-copy">
            <strong>{item.title}</strong>
            <small>
              {item.area.toFixed(1)} м² · {ROOM_TYPES[item.roomType].label}
            </small>
            {item.description && <small>{item.description}</small>}
            {opening === item.id && (
              <small role="status">Өрөөг нээж байна…</small>
            )}
          </span>
        </button>
      ))}
    </div>
  );
  return (
    <div className="room-template-library">
      <article className="room-custom-card">
        <div className="room-custom-visual" aria-hidden="true">
          <span>Өөрийн хэмжээгээр</span>
          <svg viewBox="0 0 380 230">
            <defs>
              <pattern
                id="custom-room-oak"
                patternUnits="userSpaceOnUse"
                width="150"
                height="120"
              >
                <image
                  href="/textures/room/oak-natural-v1-color.webp"
                  width="150"
                  height="120"
                />
              </pattern>
            </defs>
            <path
              d="M38 134 190 76 340 134 190 210Z"
              fill="url(#custom-room-oak)"
            />
            <path d="M38 134V50L190 9V76Z" fill="#e1ded6" />
            <path d="M190 9 340 50V134L190 76Z" fill="#c3bfb7" />
            <path
              d="M38 50 190 9 340 50"
              fill="none"
              stroke="#fff"
              strokeWidth="7"
            />
            <path
              d="M38 134 190 76 340 134"
              fill="none"
              stroke="#f5f4ee"
              strokeWidth="4"
            />
            <path
              d="M76 64 119 53V116L76 132Z"
              fill="#f7f8f6"
              stroke="#fff"
              strokeWidth="5"
            />
            <path
              d="M91 60V125M106 56V120M76 87 119 75"
              stroke="#cbd4d7"
              strokeWidth="3"
            />
            <path
              d="M256 49 288 58V98L256 87Z"
              fill="#e4edef"
              stroke="#f9f9f5"
              strokeWidth="5"
            />
          </svg>
          <PencilRuler size={21} />
        </div>
        <div className="room-custom-copy">
          <h2>Өрөөгөө өөрийн хэмжээгээр байгуулъя</h2>
          <p>Хэлбэрээ зурж, хэмжээ, хаалга, цонх болон заслаа тохируулаарай.</p>
          <label>
            Өрөөний зориулалт
            <select
              value={type}
              onChange={(event) => setType(event.target.value as RoomType)}
            >
              {Object.entries(ROOM_TYPES).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={opening !== null}
            onClick={() => onBuild(type)}
          >
            Өрөө байгуулах <ArrowRight size={18} />
          </button>
        </div>
      </article>
      {error && (
        <div className="room-template-message" role="alert">
          {error}{" "}
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Дахин ачаалах
          </button>
        </div>
      )}
      {!templates && !error && (
        <p role="status">Бэлэн өрөөнүүдийг ачаалж байна…</p>
      )}
      <section aria-labelledby="empty-room-heading">
        <h2 id="empty-room-heading">Хоосон өрөөнүүд</h2>
        <p>Бэлэн хэлбэр, засалтай өрөөг сонгоод тавилгаа байрлуулаарай.</p>
        {cards(expanded ? empty : empty.slice(0, 8))}
        {templates && !empty.length && (
          <p className="room-template-empty">
            Хоосон өрөөний загварууд удахгүй нэмэгдэнэ.
          </p>
        )}
        {empty.length > 8 && (
          <button
            className="room-template-more"
            type="button"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "Цөөлж харах" : `Бүгдийг харах (${empty.length})`}
          </button>
        )}
      </section>
      <section aria-labelledby="furnished-room-heading">
        <h2 id="furnished-room-heading">Тохижуулсан өрөөнүүд</h2>
        <p>Бэлэн зохиомжийг өөрийн өрөөнд тохируулж өөрчлөөрэй.</p>
        <div className="room-template-filters">
          <div aria-label="Өрөөний төрлөөр шүүх">
            <button
              type="button"
              aria-pressed={filter === "all"}
              onClick={() => setFilter("all")}
            >
              Бүгд
            </button>
            {Object.entries(ROOM_TYPES).map(([key, value]) => (
              <button
                key={key}
                type="button"
                aria-pressed={filter === key}
                onClick={() => setFilter(key as RoomType)}
              >
                {value.label}
              </button>
            ))}
          </div>
          <label>
            Тохижилт
            <select
              value={furnishing}
              onChange={(event) => setFurnishing(event.target.value)}
            >
              <option value="all">Бүх зохиомж</option>
              <option value="full">Бүрэн тохижуулсан</option>
              <option value="partial">Хэсэгчлэн тохижуулсан</option>
            </select>
          </label>
        </div>
        {cards(furnished)}
        {templates && !furnished.length && (
          <p className="room-template-empty">
            Энэ сонголтод тохирох бэлэн зохиомж одоогоор алга.
          </p>
        )}
      </section>
    </div>
  );
}
