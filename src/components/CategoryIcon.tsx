import {
  Armchair,
  Bath,
  BedDouble,
  BedSingle,
  BookOpen,
  BriefcaseBusiness,
  Archive,
  Coffee,
  CookingPot,
  DoorClosed,
  Footprints,
  Layers3,
  Library,
  Monitor,
  PanelsTopLeft,
  Sofa,
  Table2,
  type LucideIcon,
} from "lucide-react";
import type { Category } from "@/lib/catalogCategories";

const icons: Record<Category, LucideIcon> = {
  sofa: Sofa,
  bed: BedDouble,
  "dining-table": Table2,
  wardrobe: DoorClosed,
  office: BriefcaseBusiness,
  "tv-stand": Monitor,
  bookshelf: BookOpen,
  "kitchen-cabinet": PanelsTopLeft,
  oven: CookingPot,
  chair: Armchair,
  armchair: Armchair,
  "coffee-table": Coffee,
  "side-table": Table2,
  desk: Table2,
  "office-chair": Armchair,
  dresser: Archive,
  nightstand: Archive,
  "shoe-rack": Footprints,
  "storage-shelf": Library,
  mattress: Layers3,
  "bathroom-cabinet": Bath,
  bench: BedSingle,
};

export function CategoryIcon({
  category,
  size = 28,
}: {
  category: Category;
  size?: number;
}) {
  const Icon = icons[category];
  return <Icon size={size} strokeWidth={1.5} aria-hidden="true" />;
}
