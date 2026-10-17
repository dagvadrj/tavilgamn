"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/authFetch";
import { useAuth } from "@/store/auth";
import { useDesigns } from "@/store/designs";
import type { RoomDesign } from "@/lib/types";
import type { RoomTemplate, RoomTemplateStatus } from "@/lib/roomTemplates";
import { templateId } from "@/lib/roomTemplates";
import "./room-template-admin.css";

export function useRoomTemplateAdmin(onLoad: (design: RoomDesign) => string) {
  const owner = useAuth((state) => state.user?.id);
  const role = useAuth((state) => state.role);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState<{
    template: RoomTemplate;
    designId: string;
  } | null>(null);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("roomTemplate");
    if (!id) return;
    if (role !== "admin" || !owner) {
      setError("Бэлэн өрөө засахын тулд админ эрхээр нэвтэрнэ үү.");
      return;
    }
    if (id === "new") return;
    if (!templateId(id)) {
      setError("Өрөөний дугаар буруу байна.");
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void authFetch(
      `/api/admin/room-templates?id=${id}`,
      { signal: controller.signal },
      owner,
    )
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (!controller.signal.aborted)
          setLoaded({
            template: data.template,
            designId: onLoad(data.template.design),
          });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [owner, role, onLoad]);
  return { loading, error, loaded, isAdmin: role === "admin" };
}

export function RoomTemplateAdminControls({
  design,
  initial,
  onCapture,
  onExport,
  customInterior,
  catalogReady,
}: {
  design: RoomDesign;
  initial?: RoomTemplate;
  onCapture: () => string | null;
  onExport: () => Promise<void>;
  customInterior: boolean;
  catalogReady: boolean;
}) {
  const owner = useAuth((state) => state.user?.id);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(initial);
  const [title, setTitle] = useState(initial?.title ?? design.name);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [furnishing, setFurnishing] = useState<"full" | "partial">(
    initial?.furnishing ?? "full",
  );
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function save(status: RoomTemplateStatus) {
    if (busy || !owner) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (customInterior)
        throw new Error(
          "Тусгай интерьерийг бэлэн өрөөнд хадгалах боломжгүй. Өрөөний үндсэн хана, шал болон сангийн тавилгаар зохиомжоо бэлдэнэ үү.",
        );
      if (
        status === "published" &&
        !catalogReady &&
        design.rooms?.some((room) => room.pieces.length)
      )
        throw new Error("Тавилгын сан ачаалж дууссаны дараа нийтэлнэ үү.");
      const image = onCapture();
      if (status === "published" && !image)
        throw new Error(
          "3D загварууд ачаалж дуусаагүй эсвэл зураг үүсээгүй байна. Өрөө бэлэн болсны дараа дахин нийтэлнэ үү.",
        );
      const latest = useDesigns.getState().current;
      if (!latest || latest.id !== design.id)
        throw new Error("Өрөө өөрчлөгдсөн байна. Дахин нээнэ үү.");
      const response = await authFetch(
        "/api/admin/room-templates",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: saved?.id,
            version: saved?.version,
            title,
            description,
            furnishing,
            sortOrder,
            status,
            design: latest,
            previewImage: image ?? latest.previewImage ?? "",
          }),
        },
        owner,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (
        useAuth.getState().user?.id !== owner ||
        useDesigns.getState().current?.id !== design.id
      )
        return;
      setSaved(data.template);
      setMessage(
        status === "published"
          ? "Бэлэн өрөөний санд нийтэллээ."
          : status === "archived"
            ? "Нийтийн сангаас нууж архивлалаа."
            : "Ноорог хадгаллаа.",
      );
      const url = new URL(window.location.href);
      url.searchParams.set("roomTemplate", data.template.id);
      window.history.replaceState(null, "", url);
      useDesigns.getState().saveCurrent();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Хадгалж чадсангүй.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <aside className="room-admin-tools" aria-label="Админы өрөөний хэрэгслүүд">
      <div className="room-admin-bar">
        <Link href="/admin?tab=rooms">← Өрөөний сан</Link>
        <span>Админ · Бүх засварын хэрэгсэл</span>
        <button
          type="button"
          aria-expanded={editing}
          onClick={() => setEditing((value) => !value)}
        >
          {saved ? "Бэлэн өрөөг шинэчлэх" : "Бэлэн өрөө болгож хадгалах"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setError("");
            void onExport()
              .catch((error) => setError(error.message))
              .finally(() => setBusy(false));
          }}
        >
          GLB татах
        </button>
      </div>
      {editing && (
        <form
          className="room-admin-form"
          onSubmit={(event) => {
            event.preventDefault();
            void save("draft");
          }}
        >
          <label>
            Өрөөний нэр
            <input
              required
              maxLength={100}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label>
            Товч тайлбар
            <input
              maxLength={500}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <label>
            Тохижилт
            <select
              value={furnishing}
              onChange={(event) =>
                setFurnishing(event.target.value as "full" | "partial")
              }
            >
              <option value="full">Бүрэн тохижуулсан</option>
              <option value="partial">Хэсэгчлэн тохижуулсан</option>
            </select>
          </label>
          <label>
            Харагдах дараалал
            <input
              type="number"
              min={-10000}
              max={10000}
              step={1}
              value={sortOrder}
              onChange={(event) => setSortOrder(Number(event.target.value))}
            />
          </label>
          <p>
            Тавилгагүй өрөө “Хоосон”, тавилгатай өрөө “Тохижуулсан” хэсэгт орно.{" "}
            {saved &&
              `Одоогийн төлөв: ${saved.status === "published" ? "Нийтэлсэн" : saved.status === "archived" ? "Архив" : "Ноорог"}.`}
          </p>
          <div>
            <button type="submit" disabled={busy}>
              Ноорог хадгалах
            </button>
            <button
              type="button"
              className="room-admin-primary"
              disabled={busy}
              onClick={() => void save("published")}
            >
              {busy ? "Түр хүлээнэ үү…" : "Нийтлэх"}
            </button>
            {saved && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void save("archived")}
              >
                Архивлах
              </button>
            )}
          </div>
        </form>
      )}
      {error && (
        <p className="room-admin-error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </aside>
  );
}
