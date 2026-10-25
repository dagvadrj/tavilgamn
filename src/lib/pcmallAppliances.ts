import type { Product } from "./types";
import type { KitchenAssetType, KitchenAssetPlacement } from "./kitchenAssetCatalog";

export type PcmallAppliance = {
  id: string;
  type: KitchenAssetType;
  label: string;
  model: string;
  name: string;
  width: number;
  depth: number;
  height: number;
  sourceId: string;
  imageUrl: string;
  imageFile: string;
  price: number;
  inStock: boolean;
  color: string;
  installation: "integrated" | "freestanding";
  planningPlacement: KitchenAssetPlacement;
};

// Source specifications verified on 2026-10-24. The GLBs are our dimensioned
// planning illustrations, not manufacturer CAD or installation drawings.
export const PCMALL_MODEL_VERSION = "quality-v2";
export const PCMALL_MODEL_BASE_PATH = `/models/pcmall/${PCMALL_MODEL_VERSION}`;
export const PCMALL_APPLIANCES: readonly PcmallAppliance[] = [
  { id: "10000000-1024-4026-8000-000000000001", type: "fridge", label: "Хөргөгч", model: "RR80H39C1FWT", name: "Samsung RR80H39C1FWT · 387 л",
    width: 595, depth: 644, height: 1858, sourceId: "17866920675034", imageFile: "fridge.jpg",
    imageUrl: "https://cdn.pc-mall.mn/storage/uploads/process/202609/metavalue/photo_original/0f4acfcc-336e-411a-a45e-fd88e2a4f924.jpg",
    price: 3314970, inStock: false, color: "#25272a", installation: "freestanding", planningPlacement: "floor" },
  { id: "10000000-1024-4026-8000-000000000002", type: "oven", label: "Шарах шүүгээ", model: "BOEI697688", name: "Hansa BOEI697688 · 77 л",
    width: 595, depth: 570, height: 595, sourceId: "17834239740464", imageFile: "oven.jpg",
    imageUrl: "https://cdn.pc-mall.mn/storage/uploads/process/202609/metavalue/photo_original/51e3b144-b3f3-445c-b0fd-3c3b64206650.jpg",
    price: 1789000, inStock: true, color: "#aeb2b6", installation: "integrated", planningPlacement: "floor" },
  { id: "10000000-1024-4026-8000-000000000003", type: "cooktop", label: "Тавцангийн плитка", model: "BHC60066", name: "Hansa BHC60066 · 4 ширэм",
    width: 592, depth: 522, height: 47, sourceId: "17834239702084", imageFile: "cooktop.jpg",
    imageUrl: "https://cdn.pc-mall.mn/storage/uploads/process/202609/metavalue/photo_original/f78f824e-8804-4a74-b1bf-c878da6bef5d.jpg",
    price: 1150000, inStock: true, color: "#111318", installation: "integrated", planningPlacement: "countertop" },
  { id: "10000000-1024-4026-8000-000000000004", type: "hood", label: "Хиншүү сорогч", model: "OSP6111SIH", name: "Hansa OSP6111SIH · 60 см",
    width: 598, depth: 470, height: 85, sourceId: "17386945366444", imageFile: "hood.png",
    imageUrl: "https://cdn.pc-mall.mn/storage/uploads/process/202609/metavalue/photo_original/562ef598-c5a0-4df0-a5f3-efaebbd8f3bb.png",
    price: 252350, inStock: true, color: "#b7babd", installation: "freestanding", planningPlacement: "wall" },
  { id: "10000000-1024-4026-8000-000000000005", type: "microwave", label: "Богино долгионы зуух", model: "MS23K3513AK-BW", name: "Samsung MS23K3513AK/BW · 23 л",
    width: 489, depth: 379, height: 275, sourceId: "17509361296161", imageFile: "microwave.jpg",
    imageUrl: "https://cdn.pc-mall.mn/storage/uploads/process/item/item-summit/221151054.jpg",
    price: 550600, inStock: true, color: "#15171c", installation: "freestanding", planningPlacement: "countertop" },
  { id: "10000000-1024-4026-8000-000000000006", type: "dishwasher", label: "Аяга таваг угаагч", model: "DW70H73WCB0WT", name: "Samsung DW70H73WCB0WT · 14 сет",
    width: 598, depth: 550, height: 815, sourceId: "17866921088194", imageFile: "dishwasher.jpg",
    imageUrl: "https://cdn.pc-mall.mn/storage/uploads/process/202609/metavalue/photo_original/8cdd7f7b-53e2-4996-a3cb-d00bb5fd9b72.jpg",
    price: 2882970, inStock: true, color: "#e6e7e8", installation: "integrated", planningPlacement: "floor" },
  { id: "10000000-1024-4026-8000-000000000007", type: "washing-machine", label: "Угаалгын машин", model: "F4X7ES5W", name: "LG F4X7ES5W · 11 кг",
    width: 600, depth: 565, height: 850, sourceId: "17846953431104", imageFile: "washing-machine-front.png",
    imageUrl: "https://cdn.pc-mall.mn/storage/uploads/process/202609/metavalue/photo_original/a4acc437-f044-4d03-8766-474a7b2f8963.png",
    price: 2889000, inStock: true, color: "#f0f1f2", installation: "freestanding", planningPlacement: "floor" },
];
export const pcmallSourceUrl = (item: PcmallAppliance) => `https://pc-mall.mn/products/${item.sourceId}`;
export const pcmallProductId = (item: PcmallAppliance) => `pcmall-${item.sourceId}`;
export function pcmallAppliance(productId: string, model?: { id: string; file: string }) {
  return PCMALL_APPLIANCES.find(item => pcmallProductId(item) === productId &&
    (!model || (model.id === item.id && model.file === `${item.type}.glb`)));
}
export const PCMALL_PRODUCTS: Product[] = PCMALL_APPLIANCES.map(item => ({
  id: pcmallProductId(item), name: item.name, category: "kitchen-cabinet", description: item.label,
  // Reference prices are displayed separately from merchant quotation totals.
  basePrice: 0, rating: 0, reviewCount: 0, inStock: item.inStock,
  image: `/models/pcmall/${item.imageFile}`, defaultColor: "original",
  colors: [{ id: "original", name: "Эх өнгө", hex: item.color }],
  materials: [{ id: "metal", name: "Үйлдвэрийн өнгөлгөө", priceDelta: 0 }],
  dimensions: { w: item.width / 1000, d: item.depth / 1000, h: item.height / 1000 },
  model: { id: item.id, file: `${item.type}.glb`, scale: 1, physicalSize: true },
  specifications: { sourceUrl: pcmallSourceUrl(item), sourceDate: "2026-10-24", referencePriceMnt: String(item.price),
    kitchenAsset: JSON.stringify({ version: 1, type: item.type, installation: item.installation }) },
}));
