import { CATEGORIES } from "./products";
import type { Category } from "./types";

export interface RoomCatalogGroup {
  id: string;
  label: string;
  description: string;
  image: string;
  categories: Category[];
}

const categoryImage = (id: Category) =>
  CATEGORIES.find((category) => category.id === id)!.image;

export const ROOM_CATALOG_GROUPS: RoomCatalogGroup[] = [
  {
    id: "living",
    label: "Зочны өрөө",
    description: "Амрах, хамтдаа тухлах орон зай",
    image: categoryImage("sofa"),
    categories: [
      "sofa",
      "armchair",
      "coffee-table",
      "side-table",
      "tv-stand",
      "bookshelf",
    ],
  },
  {
    id: "bedroom",
    label: "Унтлагын өрөө",
    description: "Тав тухтай амралт, цэгцтэй хадгалалт",
    image: categoryImage("bed"),
    categories: ["bed", "mattress", "wardrobe", "dresser", "nightstand"],
  },
  {
    id: "dining",
    label: "Гал тогоо, хооллох хэсэг",
    description: "Нэг ширээний ард цуглах мөчүүд",
    image: categoryImage("dining-table"),
    categories: ["dining-table", "chair", "bench", "kitchen-cabinet", "oven"],
  },
  {
    id: "office",
    label: "Ажлын өрөө",
    description: "Ажиллах, суралцах орчноо бүрдүүлэх",
    image: categoryImage("office"),
    categories: [
      "office",
      "desk",
      "office-chair",
      "bookshelf",
      "storage-shelf",
    ],
  },
  {
    id: "storage",
    label: "Хадгалалт, угаалгын өрөө",
    description: "Гутал, эд зүйлсээ эмхлэх тавилга",
    image: categoryImage("shoe-rack"),
    categories: ["shoe-rack", "storage-shelf", "bathroom-cabinet"],
  },
];

export function getRoomCatalogGroup(
  id: string | null | undefined,
): RoomCatalogGroup | undefined {
  return ROOM_CATALOG_GROUPS.find((group) => group.id === id);
}
