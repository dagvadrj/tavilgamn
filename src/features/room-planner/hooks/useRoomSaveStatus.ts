"use client";
import { useEffect, useMemo, useState } from "react";
import type { RoomDesign } from "@/lib/types";
import { roomContentKey, roomSaveStatus } from "@/lib/roomSaveStatus";

export function useRoomSaveStatus(current: RoomDesign | null, designs: RoomDesign[], storageName?: string) {
  const key = useMemo(() => current ? roomContentKey(current) : "", [current]);
  const [checked, setChecked] = useState<{ key: string; storageName: string; persisted: boolean } | null>(null);
  useEffect(() => {
    if (!key || !storageName) return;
    const check = () => {
      let persisted = false;
      try {
        const draft = JSON.parse(window.localStorage.getItem(storageName) ?? "null")?.state?.current;
        persisted = !!draft && roomContentKey(draft) === key;
      } catch { /* Surface the persistence error instead of reporting a successful save. */ }
      setChecked({ key, storageName, persisted });
    };
    const timer = window.setTimeout(check, 250);
    const onStorage = (event: StorageEvent) => { if (!event.key || event.key === storageName) check(); };
    window.addEventListener("storage", onStorage);
    return () => { window.clearTimeout(timer); window.removeEventListener("storage", onStorage); };
  }, [key, storageName]);
  const persisted = checked?.key === key && checked.storageName === storageName ? checked.persisted : undefined;
  return current ? roomSaveStatus(current, designs.find(design => design.id === current.id), persisted) : null;
}
