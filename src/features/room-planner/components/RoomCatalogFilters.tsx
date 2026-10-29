"use client";

import { Search, X } from "lucide-react";
import type { Category } from "@/lib/types";
import {
  activeRoomCatalogFilters,
  type RoomCatalogScope,
} from "@/lib/roomCatalogPolicy";
import type { PlannerCatalogSort } from "@/features/planner/components/PlannerCatalogToolbar";
import "./room-catalog-filters.css";

export function RoomCatalogFilters({
  categories,
  category,
  onCategory,
  scope,
  onScope,
  merchant,
  merchants,
  onMerchant,
  format,
  onFormat,
  sort,
  onSort,
  roomName,
  query,
  onQuery,
  count,
  onReset,
  merchantLocked,
}: {
  categories: { id: Category; name: string; count: number }[];
  category: Category | "all";
  onCategory: (value: Category | "all") => void;
  scope: RoomCatalogScope;
  onScope: (value: RoomCatalogScope) => void;
  merchant: string;
  merchants: { id: string; name: string }[];
  onMerchant: (value: string) => void;
  format: "all" | "glb" | "photo";
  onFormat: (value: "all" | "glb" | "photo") => void;
  sort: PlannerCatalogSort;
  onSort: (value: PlannerCatalogSort) => void;
  roomName: string;
  query: string;
  onQuery: (value: string) => void;
  count: number;
  onReset: () => void;
  /** Merchant editor (C3): only this store's products, no store choice. */
  merchantLocked?: string;
}) {
  // The default «this room only» scope is the starting view, not a filter.
  const filtered =
    activeRoomCatalogFilters(
      { scope, category, merchant, format, query },
      !!merchantLocked,
    ) > 0;
  return (
    <div className="room-catalog-filters">
      <label className="room-catalog-search">
        <Search size={17} aria-hidden="true" />
        <span className="sr-only">Тавилга нэрээр хайх</span>
        <input
          type="search"
          value={query}
          placeholder="Буйдан, тавиур, дэлгүүр…"
          onChange={(event) => onQuery(event.target.value)}
        />
        {query && (
          <button
            type="button"
            aria-label="Хайлт арилгах"
            onClick={() => onQuery("")}
          >
            <X size={15} />
          </button>
        )}
      </label>
      <div className="room-catalog-selects">
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
        {merchantLocked ? (
          <p className="room-catalog-locked">
            Зөвхөн {merchantLocked}-ийн бараа харагдана
          </p>
        ) : (
          <label>
            <span>Дэлгүүр</span>
            <select
              value={merchant}
              onChange={(event) => onMerchant(event.target.value)}
            >
              <option value="all">Бүх дэлгүүр</option>
              {merchants.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div
        className="room-catalog-chips"
        role="group"
        aria-label="Тавилгын ангилал"
      >
        <button
          type="button"
          aria-pressed={category === "all"}
          onClick={() => onCategory("all")}
        >
          Бүгд
        </button>
        {categories
          .filter((item) => item.count > 0 || item.id === category)
          .map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={category === item.id}
              onClick={() => onCategory(item.id)}
            >
              {item.name}
            </button>
          ))}
      </div>
      <details className="room-catalog-more">
        <summary>Нэмэлт шүүлтүүр</summary>
        <div>
          <label>
            <span>3D загвар</span>
            <select
              value={format}
              onChange={(event) =>
                onFormat(event.target.value as typeof format)
              }
            >
              <option value="all">Бүх тавилга</option>
              <option value="glb">3D загвартай</option>
              <option value="photo">3D загваргүй</option>
            </select>
          </label>
          <label>
            <span>Эрэмбэ</span>
            <select
              value={sort}
              onChange={(event) =>
                onSort(event.target.value as PlannerCatalogSort)
              }
            >
              <option value="default">Санал болгосон</option>
              <option value="name-asc">Нэр А–Я</option>
              <option value="name-desc">Нэр Я–А</option>
            </select>
          </label>
        </div>
      </details>
      <div className="room-catalog-filter-status" role="status">
        <span>{count} тавилга</span>
        {filtered && (
          <button type="button" onClick={onReset}>
            Шүүлтүүр цэвэрлэх
          </button>
        )}
      </div>
    </div>
  );
}
