"use client";
import { useDraftStatus, clearDashboardDraft } from "@/hooks/useDashboardDraft";

export function DashboardDraftNotice({ scope, disabled = false, files = [] }: { scope: string; disabled?: boolean; files?: (File | null)[] }) {
  const status = useDraftStatus(scope);
  return (
    <div className="my-3 rounded-xl border border-black/10 bg-black/[0.025] px-3 py-2 text-xs md:col-span-2 xl:col-span-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p role={status.error ? "alert" : "status"} className={status.error ? "text-red-600" : "text-black/60"}>
          {status.loading ? "Нооргийг сэргээж байна…" : status.error ? "Нооргийг төхөөрөмжид хадгалж чадсангүй. Энэ цонхоо хаалгүй мэдээллээ хадгална уу." : status.saving ? "Нооргийг хадгалж байна…" : status.restored ? "Өмнөх ноорог сэргээгдлээ. Засвараа үргэлжлүүлээрэй." : status.dirty ? "Ноорог энэ төхөөрөмжид хадгалагдсан." : "Засвар болон сонгосон файлууд автоматаар ноорогт хадгалагдана."}
        </p>
        {status.dirty && <button type="button" disabled={disabled || status.loading} className="shrink-0 underline underline-offset-2" onClick={event => {
          if (!window.confirm("Хадгалаагүй засвар болон сонгосон файлуудаа арилгах уу?")) return;
          event.currentTarget.closest("form")?.querySelectorAll<HTMLInputElement>('input[type="file"]').forEach(input => { input.value = ""; });
          void clearDashboardDraft(scope);
        }}>Ноорог арилгах</button>}
      </div>
      {files.some(Boolean) && <p className="mt-1 break-all text-black/60">Сонгосон файл: {files.filter(Boolean).map(file => file!.name).join(" · ")}</p>}
    </div>
  );
}
