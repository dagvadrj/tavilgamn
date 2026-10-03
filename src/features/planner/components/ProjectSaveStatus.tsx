"use client";
export type ProjectSaveState = "local" | "dirty" | "saving" | "saved" | "offline" | "error" | "conflict";
const labels: Record<ProjectSaveState, string> = { local: "Энэ төхөөрөмж", dirty: "Хадгалаагүй өөрчлөлт", saving: "Хадгалж байна…",
  saved: "Cloud-д хадгалсан", offline: "Сүлжээ тасарсан · local draft", error: "Хадгалалт амжилтгүй", conflict: "Хувилбар зөрсөн" };
export function ProjectSaveStatus({ state, revision = 0 }: { state: ProjectSaveState; revision?: number }) {
  return <span className="planner-project-status" data-state={state} role="status" aria-live="polite" aria-atomic="true">
    {labels[state]}{revision > 0 && <small> · v{revision}</small>}
  </span>;
}
export function ProjectSaveRecovery({ state, error, busy, onRetry, onCopy, onReload }: {
  state: ProjectSaveState; error: string; busy: boolean; onRetry: () => void; onCopy: () => void; onReload?: () => void;
}) {
  if (!error) return null;
  return <section className="planner-project-recovery" aria-label="Хадгалалтыг сэргээх">
    <p role="alert">{error}</p>
    <p>Өөрчлөлт editor-д хэвээр байна. Хамгийн сүүлийн загварыг нээхэд одоогийн draft энэ төхөөрөмжийн жагсаалтад үлдэнэ.</p>
    <div>
      {state !== "conflict" && <button type="button" disabled={busy} onClick={onRetry}>Дахин хадгалах</button>}
      <button type="button" disabled={busy} onClick={onCopy}>Хуулбар болгон хадгалах</button>
      {onReload && <button type="button" disabled={busy} onClick={onReload}>Хамгийн сүүлийн загварыг нээх</button>}
    </div>
  </section>;
}
