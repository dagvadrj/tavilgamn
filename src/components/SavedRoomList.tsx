"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/store/auth";
import { useRoomProjects } from "@/store/roomProjects";
import { useDesigns } from "@/store/designs";
import { localRoomImportCandidates } from "@/lib/roomLocalStorage";
import { roomDocument } from "@/lib/roomProjectValidation";
export function SavedRoomList() {
  const user = useAuth((s) => s.user),
    library = useRoomProjects();
  const [archived, setArchived] = useState(false),
    [pending, setPending] = useState(""),
    [message, setMessage] = useState("");
  const [local, setLocal] = useState<
    ReturnType<typeof localRoomImportCandidates>
  >({ items: [], warnings: [] });
  useEffect(() => {
    setMessage("");
    setPending("");
    if (user && library.owner === user.id) {
      setLocal(localRoomImportCandidates(user.id));
      void useRoomProjects.getState().refresh(false, archived);
    } else setLocal({ items: [], warnings: [] });
  }, [user, library.owner, archived]);
  if (!user) return null;
  async function importLocal(candidate: (typeof local.items)[number]) {
    if (!user || pending) return;
    const owner = user.id;
    setPending(candidate.design.id);
    setMessage("");
    try {
      const document = roomDocument(candidate.design);
      const project = await useRoomProjects
        .getState()
        .save(
          crypto.randomUUID(),
          candidate.design.name,
          document,
          0,
          `browser:${candidate.design.id}`,
        );
      if (useRoomProjects.getState().owner !== owner) return;
      if (project) {
        useDesigns.getState().recordCloudSave(candidate.design.id, project);
        setMessage(
          `${project.name}: cloud-д хадгалсан. Local эх загвар хэвээр байна.`,
        );
      }
    } catch (e) {
      if (useRoomProjects.getState().owner === owner)
        setMessage(e instanceof Error ? e.message : "Импорт амжилтгүй.");
    } finally {
      if (useRoomProjects.getState().owner === owner) setPending("");
    }
  }
  return (
    <div className="saved-room-list">
      <div className="account-section-heading">
        <h3>Cloud өрөөний загварууд</h3>
        <button
          type="button"
          className="btn-ghost"
          disabled={library.loading || !!pending}
          onClick={() => setArchived((value) => !value)}
        >
          {archived ? "Идэвхтэй загварууд" : "Архив"}
        </button>
      </div>
      {library.error && (
        <p className="shop-error" role="alert">
          {library.error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {library.loading && <p role="status">Загварууд ачаалж байна…</p>}
      {!library.loading && library.loaded && !library.items.length && (
        <p className="shop-muted">
          {archived
            ? "Архив хоосон байна."
            : "Cloud загвар хараахан байхгүй. Local загвараа сонгож импортлоорой."}
        </p>
      )}
      <div className="grid gap-3">
        {library.items.map((project) => (
          <article className="account-design-card" key={project.id}>
            <div>
              <h4>{project.name}</h4>
              <p className="shop-muted text-xs">
                {project.roomCount} өрөө · {project.pieceCount} тавилга · v
                {project.revision}
              </p>
              <p className="shop-muted text-xs">
                {new Date(project.updatedAt).toLocaleString("mn-MN")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                className="btn-ghost"
                href={`/planner?project=${encodeURIComponent(project.id)}`}
              >
                Нээх
              </Link>
              <button
                type="button"
                className="btn-ghost"
                disabled={!!pending || library.loading}
                onClick={async () => {
                  if (
                    !window.confirm(
                      archived
                        ? `“${project.name}” загварыг сэргээх үү?`
                        : `“${project.name}” загварыг архивлах уу? Хувилбарын түүх хэвээр үлдэнэ.`,
                    )
                  )
                    return;
                  setPending(project.id);
                  await library.archive(
                    project.id,
                    project.revision,
                    !archived,
                  );
                  setPending("");
                }}
              >
                {archived ? "Сэргээх" : "Архивлах"}
              </button>
            </div>
          </article>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        <button
          type="button"
          className="btn-ghost"
          disabled={library.loading || !!pending}
          onClick={() => void library.refresh(false, archived)}
        >
          Жагсаалт шинэчлэх
        </button>
        {library.cursor && (
          <button
            type="button"
            className="btn-ghost"
            disabled={library.loading}
            onClick={() => void library.refresh(true, archived)}
          >
            Дараагийн загварууд
          </button>
        )}
      </div>
      <details className="room-local-import mt-5">
        <summary>
          Энэ төхөөрөмжийн загваруудыг cloud-д импортлох · {local.items.length}
        </summary>
        <p className="shop-muted text-sm">
          Загвар бүрийг сонгож импортлоно. Зочны болон хуучин local өгөгдлийг
          устгахгүй; давтан импорт cloud хуулбар давхар үүсгэхгүй.
        </p>
        {local.warnings.map((warning) => (
          <p role="alert" key={warning}>
            {warning}
          </p>
        ))}
        {local.items.map((candidate) => (
          <article className="account-design-card" key={candidate.design.id}>
            <div>
              <h4>{candidate.design.name}</h4>
              <p className="shop-muted text-xs">
                {candidate.source} · {candidate.design.rooms?.length ?? 1} өрөө
              </p>
            </div>
            <button
              type="button"
              className="btn-ghost"
              disabled={!!pending || archived}
              onClick={() => void importLocal(candidate)}
              aria-label={`${candidate.design.name} импортлох`}
            >
              {pending === candidate.design.id
                ? "Импортлож байна…"
                : "Импортлох"}
            </button>
          </article>
        ))}
      </details>
    </div>
  );
}
