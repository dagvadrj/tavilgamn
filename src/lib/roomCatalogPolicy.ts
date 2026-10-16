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
    return scope === "all" || type === "other" || (item.roomTypes?.length
        ? item.roomTypes.includes(type) : ROOM_CATALOG_CATEGORIES[type].includes(item.category));
}
export function roomCatalogPolicy<T extends CatalogEntry>(items: T[], options: {
    roomType: RoomType;
    scope: RoomCatalogScope;
    category: Category | "all";
    query: string;
}) {
    const eligible = items.filter(item => hasAvailableStock(item) && catalogEligible(item, options.roomType, options.scope));
    const ordered = options.scope === "all" ? CATEGORIES.map(c => c.id) : [
        ...ROOM_CATALOG_CATEGORIES[options.roomType],
        ...eligible.map(item => item.category).filter(category => !ROOM_CATALOG_CATEGORIES[options.roomType].includes(category)),
    ];
    const categories = [...new Set(ordered)].map(id => ({
        ...CATEGORIES.find(category => category.id === id)!,
        count: eligible.filter(item => item.category === id && matchesProductSearch(item, options.query)).length,
    }));
    const category = options.category !== "all" && !categories.some(c => c.id === options.category) ? "all" : options.category;
    return { categories, category, products: eligible.filter(item => (options.category === "all" || item.category === options.category) && matchesProductSearch(item, options.query)) };
}
