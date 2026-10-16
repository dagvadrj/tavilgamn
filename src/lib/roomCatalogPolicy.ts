import { CATEGORIES } from "./catalogCategories";
import type { Category, RoomType } from "./types";
import { matchesProductSearch } from "./productSearch";
import { hasAvailableStock } from "./inventory";
/** Ordered eligibility, shared by photo products, models and furnishing suggestions. */
export const ROOM_CATALOG_CATEGORIES: Record<RoomType, readonly Category[]> = {
    living: ["sofa", "armchair", "coffee-table", "tv-stand", "bookshelf", "side-table", "dresser", "storage-shelf", "bench"],
    bedroom: ["bed", "wardrobe", "dresser", "nightstand", "side-table", "mattress", "bench", "bookshelf", "armchair"],
    kitchen: ["kitchen-cabinet", "oven", "dining-table", "chair", "storage-shelf", "bench"],
    office: ["desk", "office-chair", "office", "bookshelf", "storage-shelf", "side-table", "chair"],
    bathroom: ["bathroom-cabinet", "storage-shelf", "bench"],
    other: CATEGORIES.map(category => category.id),
};
export type RoomCatalogScope = "room" | "all";
type CatalogEntry = {
    name: string;
    category: Category;
    description: string;
    roomTypes?: RoomType[];
    inStock: boolean;
    stockQuantity?: number | null;
};
export function catalogEligible(item: Pick<CatalogEntry, "category" | "roomTypes">, type: RoomType, scope: RoomCatalogScope) {
    return scope === "all" || (item.roomTypes?.length
        ? item.roomTypes.includes(type) : ROOM_CATALOG_CATEGORIES[type].includes(item.category));
}
export type RoomCatalogOptions = {
    roomType: RoomType;
    scope: RoomCatalogScope;
    category: Category | "all";
    query: string;
};
export function roomCatalogPolicy<T extends CatalogEntry>(items: T[], options: RoomCatalogOptions) {
    const eligible = items.filter(item => hasAvailableStock(item) && catalogEligible(item, options.roomType, options.scope));
    const ordered = options.scope === "all" ? CATEGORIES.map(c => c.id) : [
        ...ROOM_CATALOG_CATEGORIES[options.roomType],
        ...eligible.map(item => item.category).filter(category => !ROOM_CATALOG_CATEGORIES[options.roomType].includes(category)),
    ];
    const matching = eligible.filter(item => matchesProductSearch(item, options.query));
    const counts = new Map<Category, number>();
    for (const item of matching) counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    const categories = [...new Set(ordered)].map(id => ({
        ...CATEGORIES.find(category => category.id === id)!,
        count: counts.get(id) ?? 0,
    }));
    const category = options.category !== "all" && !categories.some(c => c.id === options.category) ? "all" : options.category;
    return { categories, category, matching, products: matching.filter(item => category === "all" || item.category === category) };
}

/** Normalize the category once across both formats, including authored shared-room items. */
export function roomPlannerCatalog<P extends CatalogEntry, M extends CatalogEntry>(photos: P[], models: M[], options: RoomCatalogOptions & { format: "all" | "photo" | "glb" }) {
    const entries = [
        ...photos.map(item => ({ ...item, format: "photo" as const, item })),
        ...models.map(item => ({ ...item, format: "glb" as const, item })),
    ];
    const selection = roomCatalogPolicy(entries, options);
    const counts = new Map<Category, number>();
    for (const entry of selection.matching) {
        if (options.format === "all" || entry.format === options.format) {
            counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1);
        }
    }
    return {
        category: selection.category,
        categories: selection.categories.map(category => ({ ...category, count: counts.get(category.id) ?? 0 })),
        photos: selection.products.flatMap(entry => entry.format === "photo" ? [entry.item] : []),
        models: selection.products.flatMap(entry => entry.format === "glb" ? [entry.item] : []),
    };
}
