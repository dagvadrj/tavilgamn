"use client";
import { useEffect, useRef } from "react";
export type LodUploadFiles = { medium: File | null; low: File | null };
export function ModelLodInputs({ value, onChange }: { value: LodUploadFiles; onChange: (value: LodUploadFiles) => void }) {
  const medium = useRef<HTMLInputElement>(null), low = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!value.medium && medium.current) medium.current.value = "";
    if (!value.low && low.current) low.current.value = "";
  }, [value.medium, value.low]);
  return <details className="mt-3 rounded-lg border border-ink/10 p-3">
    <summary className="cursor-pointer text-sm">Хөнгөн 3D хувилбарууд · сонголтоор</summary>
    <p className="my-2 text-xs text-ink/60">Үндсэн GLB-д high (…-0.glb), доор medium (…-1.glb), low (…-2.glb) файлуудыг сонгоно. Нэг моделийн гурван хувилбар байна.</p>
    {(["medium", "low"] as const).map(level => <label key={level} className="mb-2 block text-sm">{level === "medium" ? "Дунд нягтрал · medium" : "Бага нягтрал · low"}
      <input ref={level === "medium" ? medium : low} type="file" accept=".glb,model/gltf-binary" className="input mt-1"
        onChange={event => onChange({ ...value, [level]: event.target.files?.[0] ?? null })} />
    </label>)}
  </details>;
}
