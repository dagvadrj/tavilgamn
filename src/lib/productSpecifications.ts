import type { Category } from "./catalogCategories";
import { CATEGORY_LABEL } from "./catalogCategories";
import type { Product } from "./types";

export type SpecificationField = {
  key: string;
  label: string;
  placeholder: string;
};
const common: SpecificationField[] = [
  { key: "type", label: "Төрөл", placeholder: "Жишээ: агуулахын тавиур" },
  {
    key: "materialDetail",
    label: "Материалын дэлгэрэнгүй",
    placeholder: "Жишээ: ган каркас, MDF хавтан",
  },
  {
    key: "assembly",
    label: "Угсралт",
    placeholder: "Жишээ: боолттой, угсарч салгадаг",
  },
  {
    key: "style",
    label: "Загварын хэв маяг",
    placeholder: "Жишээ: Modern / Industrial",
  },
  { key: "warranty", label: "Баталгаа", placeholder: "Жишээ: 12 сар" },
];
const shelf: SpecificationField[] = [
  { key: "tiers", label: "Тавиурын давхар", placeholder: "Жишээ: 5" },
  {
    key: "loadCapacity",
    label: "Даац",
    placeholder: "Жишээ: давхар бүр 50 кг",
  },
];
const cabinet: SpecificationField[] = [
  { key: "doors", label: "Хаалганы тоо", placeholder: "Жишээ: 2" },
  { key: "drawers", label: "Шургуулгын тоо", placeholder: "Жишээ: 3" },
  {
    key: "storage",
    label: "Хадгалах хэсэг",
    placeholder: "Жишээ: өлгүүр, тавиуртай",
  },
];
const seating: SpecificationField[] = [
  { key: "seats", label: "Суудлын тоо", placeholder: "Жишээ: 3 хүн" },
  {
    key: "upholstery",
    label: "Бүрээс",
    placeholder: "Жишээ: салдаг даавуун бүрээс",
  },
  { key: "seatHeight", label: "Суудлын өндөр", placeholder: "Жишээ: 45 см" },
];
const table: SpecificationField[] = [
  {
    key: "shape",
    label: "Тавцангийн хэлбэр",
    placeholder: "Жишээ: тэгш өнцөгт",
  },
  {
    key: "extendable",
    label: "Сунгах боломж",
    placeholder: "Жишээ: 120–180 см хүртэл сунгадаг",
  },
];
const bed: SpecificationField[] = [
  {
    key: "mattressSize",
    label: "Матрасын хэмжээ",
    placeholder: "Жишээ: 160 × 200 см",
  },
  {
    key: "storage",
    label: "Хадгалах хэсэг",
    placeholder: "Жишээ: доороо 2 шургуулгатай",
  },
  {
    key: "headboard",
    label: "Орны толгой",
    placeholder: "Жишээ: зөөлөн бүрээстэй",
  },
];
const specific: Partial<Record<Category, SpecificationField[]>> = {
  sofa: [
    ...seating,
    {
      key: "convertible",
      label: "Ор болгох боломж",
      placeholder: "Жишээ: дэлгэж ор болгодог",
    },
  ],
  armchair: seating,
  chair: seating,
  bench: seating,
  "office-chair": [
    ...seating,
    {
      key: "adjustment",
      label: "Тохируулга",
      placeholder: "Жишээ: өндөр, түшлэг тохируулдаг",
    },
  ],
  bed,
  mattress: [
    { key: "firmness", label: "Хатуулаг", placeholder: "Жишээ: дунд зэргийн" },
    { key: "thickness", label: "Зузаан", placeholder: "Жишээ: 25 см" },
    {
      key: "filling",
      label: "Дүүргэлт",
      placeholder: "Жишээ: pocket пүрш, хөөс",
    },
  ],
  "dining-table": [
    ...table,
    { key: "seats", label: "Суух хүний тоо", placeholder: "Жишээ: 6 хүн" },
  ],
  "coffee-table": table,
  "side-table": table,
  desk: [...table, ...cabinet.slice(1)],
  office: [...table, ...cabinet],
  wardrobe: cabinet,
  dresser: cabinet,
  nightstand: cabinet,
  "tv-stand": cabinet,
  "kitchen-cabinet": cabinet,
  "bathroom-cabinet": cabinet,
  bookshelf: shelf,
  "storage-shelf": shelf,
  "shoe-rack": shelf,
  oven: [
    { key: "power", label: "Чадал", placeholder: "Жишээ: 2000 Вт" },
    { key: "capacity", label: "Багтаамж", placeholder: "Жишээ: 60 литр" },
    {
      key: "energyClass",
      label: "Эрчим хүчний ангилал",
      placeholder: "Жишээ: A+",
    },
  ],
};

export function specificationFields(category: Category): SpecificationField[] {
  return [...common.map(field => field.key === "type" ? { ...field, placeholder: `Жишээ: ${CATEGORY_LABEL[category]}` } : field), ...(specific[category] ?? [])];
}

export function parseSpecifications(value: unknown): Record<string, string> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length > 30
  ) {
    throw new Error("Үзүүлэлтийн мэдээлэл буруу байна.");
  }
  const allowed = new Set(
    [...common, ...Object.values(specific).flat()].map((field) => field.key),
  );
  const entries = Object.entries(value);
  if (
    entries.some(
      ([key, text]) =>
        !allowed.has(key) || typeof text !== "string" || text.length > 300,
    )
  ) {
    throw new Error("Үзүүлэлт бүр 300-аас ихгүй тэмдэгттэй байна.");
  }
  return Object.fromEntries(
    entries
      .filter(([, text]) => (text as string).trim())
      .map(([key, text]) => [key, (text as string).trim()]),
  );
}

export function productSpecificationRows(
  product: Product,
): { label: string; value: string }[] {
  const values = product.specifications ?? {};
  const dimensions = (value: number) =>
    `${Number((value * 100).toFixed(2))} см`;
  return [
    { label: "Төрөл", value: values.type || CATEGORY_LABEL[product.category] },
    {
      label: "Материал",
      value:
        values.materialDetail ||
        product.materials.map((item) => item.name).join(", "),
    },
    {
      label: "Өнгө",
      value: product.colors.map((item) => item.name).join(", "),
    },
    { label: "Өргөн", value: dimensions(product.dimensions.w) },
    { label: "Гүн", value: dimensions(product.dimensions.d) },
    { label: "Өндөр", value: dimensions(product.dimensions.h) },
    ...specificationFields(product.category)
      .filter(
        (field) =>
          !["type", "materialDetail"].includes(field.key) && values[field.key],
      )
      .map((field) => ({ label: field.label, value: values[field.key] })),
  ];
}
