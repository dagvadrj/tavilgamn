import type { KitchenSnapshot } from "./kitchenAssembly";
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
  /** Immutable kitchen snapshot in authored mm; rendered once at scale 1. */
  kitchen?: KitchenSnapshot;
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

export type RoomType = "living" | "bedroom" | "kitchen" | "bathroom" | "office" | "other";
export type RoomWall = "north" | "east" | "south" | "west";
export interface RoomOpening {
  id: string;
  kind: "door" | "window";
  templateId: string;
  wallId: RoomWall;
  /** Centre measured clockwise along the wall, normalized to 0–1. */
  position: number;
  /** Clear opening dimensions, in metres. */
  width: number;
  height: number;
  sillHeight: number;
  hinge: "left" | "right";
  swing: "inward" | "outward";
  open: boolean;
}
export interface WallMaterial {
  mode: "color" | "wallpaper";
  color: string;
  materialId?: string;
}
export interface CeilingFixture {
  id: string;
  /** Position in metres in the room's world coordinates. */
  x: number;
  z: number;
  intensity: number;
  color: string;
}
export interface RoomLighting {
  mode: "day" | "evening";
  ambient: number;
  sunlight: number;
  fixtures: CeilingFixture[];
}
export interface RoomSurfaces {
  floorMaterial?: string;
  wallMaterials?: Partial<Record<RoomWall, WallMaterial>>;
  ceilingMaterial?: string;
  lighting?: RoomLighting;
}
export interface WallFeature {
  id: string;
  wall: RoomWall;
  kind: "inset" | "recess";
  /** Metres from the wall's labelled starting corner, clockwise A → B → C → D. */
  offset: number;
  length: number;
  depth: number;
}
export interface RoomColumn {
  id: string;
  /** Position of the column's top-left corner, measured from the base room's A corner. */
  x: number;
  z: number;
  width: number;
  depth: number;
}
export interface RoomShape {
  width: number;
  depth: number;
  height?: number;
  wallFeatures?: WallFeature[];
  columns?: RoomColumn[];
  openings?: RoomOpening[];
}
export interface DesignRoom extends RoomShape, RoomSurfaces {
  id: string;
  name: string;
  type: RoomType;
  wallColor: string;
  floorColor: string;
  pieces: PlacedFurniture[];
}

export interface RoomDesign extends RoomShape, RoomSurfaces {
  id: string;
  name: string;
  size: RoomSize;
  /** room footprint width/depth in meters */
  width: number;
  depth: number;
  /** The top-level room fields remain the active room for older planner integrations. */
  activeRoomId?: string;
  roomName?: string;
  roomType?: RoomType;
  rooms?: DesignRoom[];
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
