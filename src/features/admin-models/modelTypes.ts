"use client";

export const CATEGORY_OPTIONS = [
  { id: "sofa", name: "Буйдан" },
  { id: "bed", name: "Ор" },
  { id: "dining-table", name: "Хоолны ширээ" },
  { id: "wardrobe", name: "Хувцасны шкаф" },
  { id: "office", name: "Оффисын тавилга" },
  { id: "tv-stand", name: "Телевизийн тавиур" },
  { id: "bookshelf", name: "Номын тавиур" },
  { id: "kitchen-cabinet", name: "Гал тогооны шүүгээ" },
  { id: "oven", name: "Плитка" },
];

export const MATERIAL_OPTIONS = [
  { id: "wood", name: "Бөх царс мод" },
  { id: "metal", name: "Өнгөлсөн төмөр" },
  { id: "fabric", name: "Маалинган даавуу" },
  { id: "leather", name: "Жинхэнэ арьс" },
  { id: "velvet", name: "Хилэн" },
];

export type ColorEntry = { name: string; hex: string; priceDelta: string };

export type MaterialEntry = { id: string; priceDelta: string };

export type ModelRecord = {
  archivedAt?: string | null;
  id: string;
  name: string;
  category: string;
  description: string;
  basePrice: number;
  stockQuantity?: number | null;
  glbFile: string;
  thumbnailFile: string;
  scale: number;
  dimensionsW: number;
  dimensionsD: number;
  dimensionsH: number;
  colors: string;
  materials: string;
  createdAt: string;
};

export type ExportState = {
  status: "idle" | "queued" | "processing" | "ready" | "error";

  ready: boolean;

  error: string | null;
};

export type ModelSection =
  "requests" | "processing" | "ready" | "error" | "archived";

export type ModelStatus = {
  id: string;

  processingStatus: "idle" | "queued" | "processing" | "ready" | "error";

  processingError: string | null;

  processingUpdatedAt: string | null;

  exportStatus: "idle" | "queued" | "processing" | "ready" | "error";

  exportError: string | null;

  standardReady: boolean;
};
