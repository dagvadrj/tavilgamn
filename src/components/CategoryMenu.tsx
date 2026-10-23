"use client";

import Image from "next/image";
import { PlannerLink as Link } from "@/components/PlannerLink";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  Factory,
  Hammer,
  LayoutGrid,
  Store,
  X,
} from "lucide-react";
import { CategoryBrowser } from "./CategoryBrowser";
import { useCatalogStore } from "@/store/catalog";
import { ROOM_CATALOG_GROUPS } from "@/lib/catalogNavigation";
import { STORE_TYPES } from "@/lib/storeTypes";
import "./category-menu.css";

const storeIcons = [Factory, Hammer, Store];
type MenuTab = "furniture" | "rooms";

export function CategoryMenu({
  open,
  onClose,
  merchant,
  admin,
}: {
  open: boolean;
  onClose: () => void;
  merchant?: boolean;
  admin?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<MenuTab>("furniture");
  const { products, ready, error, refresh } = useCatalogStore();
  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (!open) {
      dialog.current?.close();
      return;
    }
    dialog.current?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <dialog
      ref={dialog}
      id="category-menu"
      className="category-dialog"
      aria-labelledby="category-menu-title"
      onClose={onClose}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="category-menu-shell">
        <div className="category-menu-heading">
          <h2 id="category-menu-title">
            <LayoutGrid size={21} /> Бүх ангилал
          </h2>
          <button
            type="button"
            className="category-menu-close"
            onClick={onClose}
            aria-label="Ангиллын цэс хаах"
            autoFocus
          >
            <X size={23} />
          </button>
        </div>
        <div className="category-menu-layout">
          <aside
            className="category-menu-sidebar"
            aria-label="Дэлгүүр ба төлөвлөлт"
          >
            <p className="category-menu-eyebrow">Дэлгүүрийн төрлүүд</p>
            {STORE_TYPES.map((type, index) => {
              const Icon = storeIcons[index];
              return (
                <Link
                  key={type.id}
                  href={`/stores?type=${type.id}`}
                  onClick={onClose}
                >
                  <Icon size={20} />
                  <span>{type.label}</span>
                  <ChevronRight size={16} />
                </Link>
              );
            })}
            <div className="category-menu-sidebar-footer">
              <Link href="/stores" onClick={onClose}>
                Бүх дэлгүүр <ArrowUpRight size={16} />
              </Link>
              <Link href="/wishlist" onClick={onClose}>
                Хадгалсан тавилга <ArrowUpRight size={16} />
              </Link>
              <Link href="/planner" onClick={onClose}>
                Өрөөгөө төлөвлөх <ArrowUpRight size={16} />
              </Link>
              <Link href="/kitchen" onClick={onClose}>
                Гал тогоо төлөвлөх <ArrowUpRight size={16} />
              </Link>
              {merchant && (
                <Link href="/merchant" onClick={onClose}>
                  Миний дэлгүүр <ArrowUpRight size={16} />
                </Link>
              )}
              {admin && (
                <Link href="/admin" onClick={onClose}>
                  Удирдлага <ArrowUpRight size={16} />
                </Link>
              )}
            </div>
          </aside>
          <div className="category-menu-main">
            <div className="category-menu-intro">
              <h3>Гэрээ өөрийнхөөрөө</h3>
              <Link href="/catalog" onClick={onClose}>
                Бүгдийг үзэх <ArrowRight size={16} />
              </Link>
            </div>
            <div
              className="category-menu-tabs"
              role="tablist"
              aria-label="Тавилга хайх хэлбэр"
            >
              {(
                [
                  { id: "furniture", label: "Бүх тавилга" },
                  { id: "rooms", label: "Өрөөнүүд" },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  id={`category-tab-${item.id}`}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.id}
                  aria-controls={`category-panel-${item.id}`}
                  tabIndex={tab === item.id ? 0 : -1}
                  onClick={() => setTab(item.id)}
                  onKeyDown={(event) => {
                    if (
                      !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                        event.key,
                      )
                    )
                      return;
                    event.preventDefault();
                    const next =
                      event.key === "Home"
                        ? "furniture"
                        : event.key === "End"
                          ? "rooms"
                          : tab === "furniture"
                            ? "rooms"
                            : "furniture";
                    setTab(next);
                    dialog.current
                      ?.querySelector<HTMLButtonElement>(
                        `#category-tab-${next}`,
                      )
                      ?.focus();
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div
              id="category-panel-furniture"
              role="tabpanel"
              aria-labelledby="category-tab-furniture"
              hidden={tab !== "furniture"}
              tabIndex={0}
            >
              {error && (
                <p role="status">
                  Тоог ачаалж чадсангүй.{" "}
                  <button type="button" onClick={() => void refresh(true)}>
                    Дахин оролдох
                  </button>
                </p>
              )}
              <CategoryBrowser
                products={products}
                ready={ready}
                onNavigate={onClose}
              />
            </div>
            <div
              id="category-panel-rooms"
              role="tabpanel"
              aria-labelledby="category-tab-rooms"
              hidden={tab !== "rooms"}
              tabIndex={0}
            >
              <div className="category-room-grid">
                {ROOM_CATALOG_GROUPS.map((group) => (
                  <Link
                    key={group.id}
                    href={`/catalog?room=${group.id}`}
                    className="category-room-card"
                    onClick={onClose}
                  >
                    <div className="category-room-image">
                      <Image
                        src={group.image}
                        alt=""
                        fill
                        sizes="(max-width: 767px) 40vw, 280px"
                      />
                    </div>
                    <strong>{group.label}</strong>
                    <span>{group.description}</span>
                    <span className="category-room-cta">
                      Тавилга үзэх <ArrowRight size={15} />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </dialog>
  );
}
