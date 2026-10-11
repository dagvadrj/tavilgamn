"use client";
import { Box, Columns3, Paintbrush, Refrigerator, Zap } from "lucide-react";
import type { KitchenStandardType } from "@/lib/kitchenStandardCatalog";

export function KitchenCategoryRail({
  disabled,
  materials,
  onCategory,
  onMaterials,
}: {
  disabled: boolean;
  materials: boolean;
  onCategory: (type: KitchenStandardType) => void;
  onMaterials: () => void;
}) {
  return (
    <div className="kitchen-category-rail">
      <nav aria-label="Модуль ангилал">
        {(
          [
            ["base", "Доод шүүгээ (Base)", Refrigerator],
            ["wall", "Дээд шүүгээ (Wall)", Box],
            ["tall", "Багана шүүгээ (Tall)", Columns3],
            ["hob", "Цахилгаан хэрэгсэл", Zap],
          ] as const
        ).map(([type, label, Icon]) => (
          <button
            type="button"
            key={type}
            disabled={disabled}
            onClick={() => onCategory(type)}
          >
            <Icon size={20} />
            {label}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled}
          aria-pressed={materials}
          onClick={onMaterials}
        >
          <Paintbrush size={20} />
          Тавцан ба фасад
        </button>
      </nav>
      <footer>
        <span>
          Хэмжих нэгж <b>мм</b>
        </span>
        <span>
          Хананд наалдах <b>Идэвхтэй</b>
        </span>
      </footer>
    </div>
  );
}
