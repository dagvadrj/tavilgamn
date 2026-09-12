"use client";
import { create } from "zustand";
import { supabase } from "@/lib/supabase/client";
import { parseKitchen, type SavedKitchen } from "@/lib/kitchenAssembly";
import type { ModularKitchen } from "@/lib/kitchenCabinets";

interface KitchenState {
  owner: string | null; items: SavedKitchen[]; loading: boolean; loaded: boolean; error: string;
  refresh: () => Promise<void>;
  save: (id: string, name: string, design: ModularKitchen) => Promise<SavedKitchen | null>;
  remove: (id: string) => Promise<boolean>;
}
let generation = 0, listRequest = 0;
function readSaved(row: { id: string; name: string; design: unknown; created_at: string; updated_at: string }): SavedKitchen {
  return { id: row.id, name: row.name, design: parseKitchen(row.design), createdAt: row.created_at, updatedAt: row.updated_at };
}
async function request(owner: string, init: RequestInit = {}, query = "") {
  const { data } = await supabase.auth.getSession();
  if (!data.session || data.session.user.id !== owner) throw new Error("Хадгалахын тулд нэвтэрнэ үү.");
  const response = await fetch(`/api/kitchens${query}`, { ...init, cache: "no-store", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Гарнитурын сан холбогдсонгүй.");
  return body;
}
export const useKitchens = create<KitchenState>((set, get) => ({
  owner: null, items: [], loading: false, loaded: false, error: "",
  refresh: async () => {
    if (get().loading) return;
    const owner = get().owner, epoch = generation, requestId = ++listRequest;
    if (!owner) return;
    set({ loading: true, error: "" });
    try {
      const body = await request(owner);
      if (epoch === generation && requestId === listRequest) set({ items: body.kitchens.map(readSaved), loading: false, loaded: true });
    } catch (error) {
      if (epoch === generation && requestId === listRequest) set({ loading: false, error: error instanceof Error ? error.message : "Ачаалж чадсангүй." });
    }
  },
  save: async (id, name, design) => {
    const owner = get().owner, epoch = generation;
    if (!owner) { set({ error: "Хадгалахын тулд нэвтэрнэ үү." }); return null; }
    // Prevent a stale list response overwriting this successful save.
    ++listRequest; set({ error: "", loading: false });
    try {
      const result = readSaved((await request(owner, { method: "PUT", body: JSON.stringify({ id, name, design }) })).kitchen);
      if (epoch !== generation) return null;
      ++listRequest;
      set({ items: [result, ...get().items.filter(item => item.id !== id)], loading: false }); return result;
    } catch (error) { if (epoch === generation) set({ error: error instanceof Error ? error.message : "Хадгалж чадсангүй." }); return null; }
  },
  remove: async id => {
    const owner = get().owner, epoch = generation; if (!owner) return false;
    ++listRequest; set({ error: "", loading: false });
    try {
      await request(owner, { method: "DELETE" }, `?id=${encodeURIComponent(id)}`);
      if (epoch !== generation) return false;
      ++listRequest;
      set({ items: get().items.filter(item => item.id !== id), loading: false }); return true;
    } catch (error) { if (epoch === generation) set({ error: error instanceof Error ? error.message : "Устгаж чадсангүй." }); return false; }
  },
}));
export function setKitchenOwner(owner: string | null) {
  if (useKitchens.getState().owner === owner) return;
  generation++; listRequest++;
  useKitchens.setState({ owner, items: [], loading: false, loaded: false, error: "" });
}
