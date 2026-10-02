"use client";
import { useEffect, useRef, useState } from "react";
import { useKitchens, type KitchenVersionSummary } from "@/store/kitchens";
import type { ModularKitchen } from "@/lib/kitchenCabinets";
export function VersionHistory({
  id,
  revision,
  disabled,
  onRestore,
  onBusyChange,
}: {
  id: string;
  revision: number;
  disabled: boolean;
  onRestore: (name: string, design: ModularKitchen) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [open, setOpen] = useState(false),
    [items, setItems] = useState<KitchenVersionSummary[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const generation = useRef(0);
  useEffect(() => {
    onBusyChange(loading);
    return () => onBusyChange(false);
  }, [loading, onBusyChange]);
  useEffect(() => {
    setItems([]);
    setOpen(false);
    setLoading(false);
    generation.current++;
  }, [id, revision]);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  async function load(more = false) {
    if (loading || disabled) return;
    const epoch = ++generation.current;
    setLoading(true);
    setError("");
    setOpen(true);
    try {
      const list = await useKitchens
        .getState()
        .versions(id, more ? items.at(-1)?.revision : undefined);
      if (epoch === generation.current)
        setItems((current) => (more ? [...current, ...list] : list));
    } catch (e) {
      if (epoch === generation.current)
        setError(e instanceof Error ? e.message : "Ачаалсангүй.");
    } finally {
      if (epoch === generation.current) setLoading(false);
    }
  }
  async function restore(target: number) {
    if (loading || disabled) return;
    const epoch = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const version = await useKitchens.getState().version(id, target);
      if (epoch === generation.current) onRestore(version.name, version.design);
    } catch (e) {
      if (epoch === generation.current)
        setError(e instanceof Error ? e.message : "Сэргээсэнгүй.");
    } finally {
      if (epoch === generation.current) setLoading(false);
    }
  }
  return (
    <section
      className="km-version-history"
      aria-label="Загварын хувилбарын түүх"
    >
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => (open ? setOpen(false) : void load())}
      >
        Хувилбарын түүх · v{revision}
      </button>
      {open && (
        <>
          <p>
            Хувилбар сонгох нь редакторт ачаална. Хадгалах үед шинэ хувилбар
            болно; хуучин түүх арилахгүй. Дуусаагүй өөрчлөлтөө эхлээд хадгалах
            эсвэл undo-оор буцааж болно.
          </p>
          {items.map((item) => (
            <div key={item.revision}>
              <span>
                v{item.revision} · {item.name} ·{" "}
                {new Date(item.created_at).toLocaleString("mn-MN")}
              </span>
              <button
                type="button"
                disabled={disabled || loading}
                onClick={() => void restore(item.revision)}
              >
                v{item.revision} сэргээх
              </button>
            </div>
          ))}
          {items.length > 0 && items.length % 30 === 0 && (
            <button
              type="button"
              disabled={loading}
              onClick={() => void load(true)}
            >
              Өмнөх хувилбарууд
            </button>
          )}
        </>
      )}
      {loading && <p role="status">Хувилбар ачаалж байна…</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
