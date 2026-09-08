import type { Store } from "./types";

export const STORES: Store[] = [
  {
    id: "top-mebel",
    name: "Топ Мебель",
    city: "Улаанбаатар",
    district: "Баянзүрх дүүрэг",
    address: "1-р хороо, Токиогийн гудамж",
    phone: "11-456155",
    categories: ["sofa", "bed", "wardrobe", "office"],
    description:
      "1994 оноос үйл ажиллагаа явуулж буй, зах зээлд тэргүүлэгч тавилгын томоохон дэлгүүрүүдийн нэг.",
    image:
      "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1200&q=80",
    productIds: ["halden-sofa", "marlow-loveseat", "atelier-sectional", "linnea-bed", "kiona-bed"],
  },
  {
    id: "gobi-khangai-mebel",
    name: "Говь Хангай мебель",
    city: "Улаанбаатар",
    district: "3, 4-р хороолол",
    address: "И-март дэлгүүрийн хажууд, Хаан банктай байрны 2 давхарт",
    phone: "9904-0828",
    categories: ["sofa", "dining-table", "bed"],
    description:
      "3, 4-р хороололд байрлах, өргөн сонголттой тавилгын их дэлгүүр.",
    image:
      "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&q=80",
    productIds: ["tavola-dining", "fjord-dining", "north-wardrobe", "alpine-wardrobe", "studio-desk"],
  },
  {
    id: "mebel-town",
    name: "Мебель Таун",
    city: "Улаанбаатар",
    district: "Мишээл Экспо төв",
    address: "Мишээл Экспо төв, Мебель Таун салбар",
    phone: "77199999",
    categories: ["sofa", "bed", "wardrobe", "tv-stand", "office", "bookshelf"],
    description:
      "Олон брэндийн тавилгыг нэг дор санал болгодог, салбар сүлжээтэй том худалдааны төв.",
    image:
      "https://images.unsplash.com/photo-1555636222-cae831e670b3?auto=format&fit=crop&w=1200&q=80",
    productIds: ["ergo-chair", "luma-tv-stand", "casa-tv-stand", "atlas-bookshelf", "spine-bookshelf"],
  },
  {
    id: "sunder-urguu-trade",
    name: "Сүндэр Өргөө Трейд",
    city: "Улаанбаатар",
    district: "Баянзүрх дүүрэг",
    address: "Их тойруу, Ундрам плаза, 10 давхар",
    phone: "-",
    categories: ["sofa", "office", "wardrobe"],
    description:
      "Герман технологиор тавилга үйлдвэрлэдэг, захиалгат тавилгын үйлчилгээ үзүүлдэг компани.",
    image:
      "https://images.unsplash.com/photo-1631679706909-1844bbd07221?auto=format&fit=crop&w=1200&q=80",
    productIds: [],
  },
  {
    id: "magnetto",
    name: "Магнетто",
    city: "Улаанбаатар",
    district: "-",
    address: "-",
    phone: "-",
    categories: ["sofa", "bed", "bookshelf", "office", "dining-table"],
    description:
      "Итали, Герман, Австри, Солонгосын чанартай материал ашигладаг тавилгын үйлдвэр, гал тогоо болон унтлагын өрөөний тавилга мэргэшсэн.",
    image:
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1200&q=80",
    productIds: [],
  },
  {
    id: "stolline-mongolia",
    name: "Stolline дэлгүүр",
    city: "Улаанбаатар",
    district: "3, 4-р хороолол",
    address: "И-март дэлгүүрийн хажууд, Хаан банктай байрны 2 давхарт",
    phone: "-",
    categories: ["sofa", "dining-table", "office"],
    description:
      "Оросын Stolline фабрикийн албан ёсны борлуулагч, буйдан, ширээ сандал, комод худалдаалдаг.",
    image:
      "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1200&q=80",
    productIds: [],
  },
  {
    id: "tumen-tavilga",
    name: "Түмэн тавилгын дэлгүүр",
    city: "Улаанбаатар",
    district: "-",
    address: "-",
    phone: "-",
    categories: ["wardrobe", "office", "bed"],
    description:
      "Монголд үйлдвэрлэдэг үндэсний тавилгын брэнд, E1 стандартын хавтангаар бүх төрлийн тавилга хийдэг.",
    image:
      "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=1200&q=80",
    productIds: [],
  },
  {
    id: "khairyn-ger",
    name: "Хайрын Гэр",
    city: "Улаанбаатар",
    district: "Хан-Уул дүүрэг",
    address: "Богд Жавзандамбын гудамж",
    phone: "9901-8121",
    categories: ["office", "bookshelf", "wardrobe"],
    description:
      "Гэр болон албан тасалгаанд зориулсан захиалгат тавилгын зураг төсөл гарган үйлдвэрлэдэг компани.",
    image:
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80",
    productIds: [],
  },
  {
    id: "shine-songolt",
    name: "Шинэ Сонголт брэнд тавилгын их дэлгүүр",
    city: "Улаанбаатар",
    district: "-",
    address: "-",
    phone: "-",
    categories: ["bed", "wardrobe"],
    description:
      "Ялангуяа хүүхдийн тавилга буюу нэг болон давхар ортой, олон үйлдэлтэй тавилгаараа алдартай их дэлгүүр.",
    image:
      "https://images.unsplash.com/photo-1567016432779-094069958ea5?auto=format&fit=crop&w=1200&q=80",
    productIds: [],
  },
  {
    id: "best-buidan",
    name: "Бест Буйдан",
    city: "Улаанбаатар",
    district: "-",
    address: "-",
    phone: "77776060",
    categories: ["sofa"],
    description:
      "Чанар, дизайны олон сонголттой буйдан голлон худалдаалдаг тавилгын дэлгүүр.",
    image:
      "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=80",
    productIds: [],
  },
  {
    id: "mungun-tavilga",
    name: "Мөнгөн Тавилга",
    city: "Улаанбаатар",
    district: "Цэцэг төвийн худалдааны гудамж",
    address: "Цэцэг төв, Худалдааны гудамж",
    phone: "-",
    categories: ["sofa", "dining-table", "office"],
    description:
      "Цэцэг төвийн худалдааны гудамжинд байрлах тавилгын дэлгүүрүүдийн нэг.",
    image:
      "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80",
    productIds: [],
  },
  {
    id: "badachi-trade",
    name: "Бадачи Треид (Топмебель эх дэлгүүр)",
    city: "Улаанбаатар",
    district: "-",
    address: "-",
    phone: "-",
    categories: ["sofa", "bed", "wardrobe", "office"],
    description:
      "1991 онд байгуулагдсан, 1994 оноос тавилгын чиглэлээр ажилладаг Топмебелийг үүсгэн байгуулсан компани.",
    image:
      "https://images.unsplash.com/photo-1540574163026-643ea20ade25?auto=format&fit=crop&w=1200&q=80",
    productIds: [],
  },
  {
    id: "narnia-mebel",
    name: "Нарниа Мебель",
    city: "Улаанбаатар",
    district: "-",
    address: "-",
    phone: "-",
    categories: ["office", "bookshelf", "tv-stand"],
    description: "Оффис болон гэр ахуйн тавилга худалдаалдаг дэлгүүрүүдийн нэг.",
    image:
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
    productIds: [],
  },
];

export function getStore(id: string): Store | undefined {
  return STORES.find((s) => s.id === id);
}

export function getStoresByCategory(category: Store["categories"][number]): Store[] {
  return STORES.filter((s) => s.categories.includes(category));
}
