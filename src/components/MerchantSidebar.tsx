"use client";

import Link from "next/link";
import {
  Armchair,
  LayoutDashboard,
  Package,
  ShoppingBag,
  Store,
  ArrowUpRight,
} from "lucide-react";

export type MerchantTab = "overview" | "products" | "orders" | "store";

const ITEMS: {
  id: MerchantTab;
  label: string;
  icon: typeof LayoutDashboard;
}[] = [
  { id: "overview", label: "Тойм", icon: LayoutDashboard },
  { id: "products", label: "Бараа", icon: Package },
  { id: "orders", label: "Захиалга", icon: ShoppingBag },
  { id: "store", label: "Дэлгүүр", icon: Store },
];

export function MerchantSidebar({
  active,
  onChange,
  hasStore,
}: {
  active: MerchantTab;
  onChange: (tab: MerchantTab) => void;
  hasStore: boolean;
}) {
  return (
    <aside className="merchant-sidebar">
      <Link href="/" className="merchant-sidebar-brand" aria-label="tavilga.mn">
        <span>
          <Armchair size={22} strokeWidth={1.7} />
        </span>
        <small>Furni</small>
      </Link>

      <nav className="merchant-sidebar-nav" aria-label="Merchant navigation">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const disabled =
            !hasStore && (item.id === "products" || item.id === "orders");

          return (
            <button
              key={item.id}
              type="button"
              title={item.label}
              disabled={disabled}
              aria-current={active === item.id ? "page" : undefined}
              className={active === item.id ? "active" : ""}
              onClick={() => onChange(item.id)}
            >
              <span className="merchant-nav-icon">
                <Icon size={20} strokeWidth={1.7} />
              </span>
              <small>{item.label}</small>
            </button>
          );
        })}
      </nav>

      <Link href="/" className="merchant-sidebar-exit" title="Дэлгүүр рүү очих">
        <ArrowUpRight size={18} />
      </Link>
    </aside>
  );
}
