import type { Product, Category } from "./types";



export const CATEGORIES: { id: Category; name: string; image: string }[] = [
  {
    id: "sofa",
    name: "Буйдан",
    image:
      "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "bed",
    name: "Ор",
    image:
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "dining-table",
    name: "Хоолны ширээ",
    image:
      "https://images.unsplash.com/photo-1617104551722-3b2d51366400?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "wardrobe",
    name: "Хувцасны шкаф",
    image:
      "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "office",
    name: "Оффисын тавилга",
    image:
      "https://images.unsplash.com/photo-1593062096033-9a26b09da705?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "tv-stand",
    name: "Зурагтын тавиур",
    image:
      "https://images.unsplash.com/photo-1615873968403-89e068629265?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "bookshelf",
    name: "Номын тавиур",
    image:
      "https://images.unsplash.com/photo-1594620302200-9a762244a156?auto=format&fit=crop&w=1200&q=80",
  },
];

export const CATEGORY_LABEL: Record<Category, string> = {
  sofa: "Буйдан",
  wardrobe: "Хувцасны шкаф",
  "dining-table": "Хоолны ширээ",
  office: "Оффисын тавилга",
  bed: "Ор",
  "tv-stand": "Зурагтын тавиур",
  bookshelf: "Номын тавиур",
};

export function priceFor(
  product: Product,
  colorId: string,
  materialId: string,
): number {
  const c = product.colors.find((x) => x.id === colorId);
  const m = product.materials.find((x) => x.id === materialId);
  return product.basePrice + (c?.priceDelta ?? 0) + (m?.priceDelta ?? 0);
}
