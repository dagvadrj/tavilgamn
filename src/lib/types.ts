export type Category =
  | "sofa"
  | "wardrobe"
  | "dining-table"
  | "office"
  | "bed"
  | "tv-stand"
  | "bookshelf";

export type Material = "wood" | "metal" | "fabric" | "leather" | "velvet";

export interface ColorOption {
  id: string;
  name: string;
  hex: string;
  priceDelta?: number;
}

export interface MaterialOption {
  id: Material;
  name: string;
  priceDelta: number;
}

export interface Product {
  id: string;
  name: string;
  category: Category;
  description: string;
  basePrice: number;
  rating: number;
  storeIds?: string[];
  model?: {
    id: string;
    file: string;
    scale: number;
  };
  reviewCount: number;
  image: string;
  /** Additional product gallery images; the primary image remains in `image`. */
  images?: string[];
  badges?: string[];
  defaultColor: string;
  colors: ColorOption[];
  materials: MaterialOption[];
  /** footprint in meters for the room planner */
  dimensions: { w: number; d: number; h: number };
  inStock: boolean;
  /** Available units shared by all variants; null means not counted yet. */
  stockQuantity?: number | null;
  isNew?: boolean;
  isBestSeller?: boolean;
}

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  image: string;
  color: string;
  material: Material;
  unitPrice: number;
  qty: number;
}

export interface WishlistItem {
  productId: string;
  addedAt: number;
}

export interface PlacedFurniture {
  instanceId: string;
  productId: string;
  /** Set when this piece was added from a DB-uploaded OBJ model */
  modelId?: string;
  /** position in meters from room origin */
  x: number;
  z: number;
  /** rotation around Y axis in radians */
  rotation: number;
  color: string;
  material: Material;
}

export type RoomSize = "40" | "80" | "120";

export interface RoomDesign {
  id: string;
  name: string;
  size: RoomSize;
  /** room footprint width/depth in meters */
  width: number;
  depth: number;
  wallColor: string;
  floorColor: string;
  pieces: PlacedFurniture[];
  createdAt: number;
  updatedAt: number;
}

export interface Review {
  id: string;
  author: string;
  avatar: string;
  rating: number;
  title: string;
  body: string;
  date: string;
  productName?: string;
}

export interface InspirationImage {
  id: string;
  src: string;
  title: string;
  style: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  joinedAt: number;
}

export interface Store {
  id: string;
  name: string;
  city: string;
  district: string;
  address: string;
  phone: string;
  categories: Category[];
  description: string;
  image: string;
  productIds: string[];
}
