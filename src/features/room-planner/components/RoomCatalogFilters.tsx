"use client";

import type { Category } from "@/lib/types";
import type { RoomCatalogScope } from "@/lib/roomCatalogPolicy";
import "./room-catalog-filters.css";

export function RoomCatalogFilters({
  categories,
  category,
  onCategory,
  scope,
  onScope,
  format,
  onFormat,
  roomName,
  query,
  count,
  onReset,
}: {
  categories: { id: Category; name: string; count: number }[];
  category: Category | "all";
  onCategory: (value: Category | "all") => void;
  scope: RoomCatalogScope;
  onScope: (value: RoomCatalogScope) => void;
  format: "all" | "glb" | "photo";
  onFormat: (value: "all" | "glb" | "photo") => void;
  roomName: string;
  query: string;
  count: number;
  onReset: () => void;
}) {
  return (
    <div className="room-catalog-filters">
      <label className="planner-reference-category">
        <span>Тавилгын ангилал</span>
        <select
          aria-label="Тавилгын ангилал"
          value={category}
          onChange={(event) =>
            onCategory(event.target.value as Category | "all")
          }
        >
          <option value="all">Бүх ангилал</option>
          {categories.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} · {item.count}
            </option>
          ))}
        </select>
      </label>
      <div className="room-catalog-extra-filters">
        <label>
          <span>Өрөө</span>
          <select
            value={scope}
            onChange={(event) =>
              onScope(event.target.value as RoomCatalogScope)
            }
          >
            <option value="room">{roomName}</option>
            <option value="all">Бүх өрөө</option>
          </select>
        </label>
        <label>
          <span>3D загвар</span>
          <select
            value={format}
            onChange={(event) => onFormat(event.target.value as typeof format)}
          >
            <option value="all">Бүх тавилга</option>
            <option value="glb">3D загвартай</option>
            <option value="photo">3D загваргүй</option>
          </select>
        </label>
        <small>3D загваргүй барааг одоогоор өрөөнд байрлуулах боломжгүй.</small>
      </div>
      <div className="room-catalog-filter-status">
        <span>
          {scope === "room" ? roomName : "Бүх өрөө"}
          {format !== "all"
            ? ` · ${format === "glb" ? "3D загвартай" : "3D загваргүй"}`
            : ""}{" "}
          · {count} тавилга
        </span>
        {(scope !== "all" ||
          category !== "all" ||
          format !== "all" ||
          query.trim()) && (
          <button type="button" onClick={onReset}>
            Цэвэрлэх
          </button>
        )}
      </div>
    </div>
  );
}
