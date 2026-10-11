export const CATEGORIES = [
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
  {
    id: "kitchen-cabinet",
    name: "Гал тогооны шүүгээ",
    image:
      "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "oven",
    name: "Плитка",
    image:
      "https://images.unsplash.com/photo-1723902499494-47b2b8cc32cf?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  },
  {
    id: "chair",
    name: "Сандал",
    image:
      "https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "armchair",
    name: "Зөөлөн сандал",
    image:
      "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "coffee-table",
    name: "Кофены ширээ",
    image:
      "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "side-table",
    name: "Хажуугийн ширээ",
    image:
      "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "desk",
    name: "Ажлын ширээ",
    image:
      "https://images.unsplash.com/photo-1593062096033-9a26b09da705?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "office-chair",
    name: "Оффисын сандал",
    image:
      "https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "dresser",
    name: "Комод",
    image:
      "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "nightstand",
    name: "Орны хажуугийн шүүгээ",
    image:
      "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "shoe-rack",
    name: "Гутлын тавиур",
    image:
      "https://images.unsplash.com/photo-1594620302200-9a762244a156?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "storage-shelf",
    name: "Агуулахын тавиур",
    image:
      "https://images.unsplash.com/photo-1594620302200-9a762244a156?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "mattress",
    name: "Матрас",
    image:
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "bathroom-cabinet",
    name: "Угаалгын өрөөний шүүгээ",
    image:
      "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "bench",
    name: "Сандал / вандан",
    image:
      "https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?auto=format&fit=crop&w=1200&q=80",
  },
] as const;

export type Category = (typeof CATEGORIES)[number]["id"];
export const CATEGORY_LABEL = Object.fromEntries(
  CATEGORIES.map(({ id, name }) => [id, name]),
) as Record<Category, string>;
export function isCategory(value: unknown): value is Category {
  return (
    typeof value === "string" &&
    CATEGORIES.some((category) => category.id === value)
  );
}
