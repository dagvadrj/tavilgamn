import { ROOM_CATALOG_GROUPS } from "./catalogNavigation";
import { hasAvailableStock } from "./inventory";
import { hasProductPhoto } from "./homeMarketplace";
import type { Category, Product } from "./types";

export interface RoomLook {
  id: string;
  label: string;
  description: string;
  image: string;
  products: Product[];
  hotspots: { productId: string; x: number; y: number }[];
}

// Coordinates belong to the room photograph, never to an arbitrary product index.
const SCENES: Record<string, { image?: string; points: { category: Category; x: number; y: number }[] }> = {
  living: { image: "/rooms/living-room.webp", points: [
    { category: "sofa", x: 30, y: 65 },
    { category: "bookshelf", x: 13, y: 30 },
    { category: "tv-stand", x: 85, y: 64 },
  ] },
  bedroom: { image: "/rooms/bedroom.webp", points: [{ category: "bed", x: 42, y: 62 }, { category: "wardrobe", x: 85, y: 40 }] },
  dining: { image: "/rooms/dining.webp", points: [{ category: "dining-table", x: 32, y: 62 }, { category: "kitchen-cabinet", x: 48, y: 30 }, { category: "oven", x: 68, y: 54 }] },
  office: { image: "/rooms/office.webp", points: [{ category: "office", x: 63, y: 62 }, { category: "bookshelf", x: 15, y: 40 }] },
};

export function buildRoomLooks(catalog: Product[]): RoomLook[] {
  const available = catalog.filter(hasAvailableStock).filter(hasProductPhoto);
  return ROOM_CATALOG_GROUPS.filter(room => SCENES[room.id]).map(room => {
    const scene = SCENES[room.id];
    const matching = available.filter(product => room.categories.includes(product.category));
    const hotspots = scene.points.flatMap(point => {
      const product = matching.find(item => item.category === point.category);
      return product ? [{ productId: product.id, x: point.x, y: point.y }] : [];
    });
    // Keep the homepage payload small while retaining every photographed category.
    const featured = matching.filter(product => hotspots.some(point => point.productId === product.id));
    const products = [...featured, ...matching.filter(product => !featured.includes(product))].slice(0, 8);
    return { id: room.id, label: room.id === "dining" ? "Гал тогоо" : room.label,
      description: room.description, image: scene.image ?? room.image, products, hotspots };
  });
}
