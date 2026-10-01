import "server-only";
import { getSupabaseAdmin } from "./supabase/admin";
import { isStoreType } from "./storeTypes";
import { CATEGORIES } from "./products";
import type { Category, Store } from "./types";

// Public projection deliberately excludes account IDs and other private fields.
const PUBLIC_FIELDS = "id,name,store_type,city,district,address,phone,description,image,categories";

export async function readStoreDirectory({ includeInactive = false }: { includeInactive?: boolean } = {}): Promise<Store[]> {
  const db = getSupabaseAdmin();
  const merchants: Store[] = [];
  // Paginate so new stores do not disappear at the database's response limit.
  for (let offset = 0; ; offset += 500) {
    let query = db.from("merchant_stores").select(PUBLIC_FIELDS);
    if (!includeInactive) query = query.eq("active", true);
    const { data, error } = await query.order("id").range(offset, offset + 499);
    if (error) {
      throw error;
    }
    for (const row of data ?? []) {
      if (!isStoreType(row.store_type)) continue;
      merchants.push({
        id: row.id, name: row.name, storeType: row.store_type,
        city: row.city, district: row.district, address: row.address,
        phone: row.phone, description: row.description, image: row.image,
        categories: Array.isArray(row.categories)
          ? row.categories.filter((value: unknown): value is Category => CATEGORIES.some(category => category.id === value)) : [],
      });
    }
    if (!data || data.length < 500) break;
  }
  return merchants;
}

export async function readDirectoryStore(id: string): Promise<Store | undefined> {
  return (await readStoreDirectory()).find(store => store.id === id);
}
