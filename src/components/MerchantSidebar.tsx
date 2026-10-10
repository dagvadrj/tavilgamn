"use client";

import Link from "next/link";
import {
  Armchair,
  LayoutDashboard,
  Package,
  ShoppingBag,
  Store,
  ArrowUpRight,
  CookingPot,
  MessageSquareQuote,
  Settings,
  CircleHelp,
} from "lucide-react";
import { DashboardSidebar } from "@/features/dashboard/components/DashboardSidebar";
import type { MerchantLocationTab } from "@/lib/merchantNavigation";

export type MerchantTab = MerchantLocationTab;

export const MERCHANT_TABS: {
  id: MerchantTab;
  label: string;
  icon: typeof LayoutDashboard;
}[] = [
  { id: "overview", label: "Ерөнхий тойм", icon: LayoutDashboard },
  { id: "products", label: "Бүтээгдэхүүн", icon: Package },
  { id: "orders", label: "Захиалгууд", icon: ShoppingBag },
  { id: "kitchens", label: "Гал тогооны загвар", icon: CookingPot },
  { id: "quotes", label: "Үнийн хүсэлтүүд", icon: MessageSquareQuote },
  { id: "store", label: "Дэлгүүрийн мэдээлэл", icon: Store },
  { id: "settings", label: "Самбарын тохиргоо", icon: Settings },
];

export function MerchantSidebar({
  active,
  onChange,
  hasStore,
  storeName,
  userName,
  open,
  onClose,
}: {
  active: MerchantTab;
  onChange: (tab: MerchantTab) => void;
  hasStore: boolean;
  storeName: string;
  userName: string;
  open: boolean;
  onClose: () => void;
}) {
  const renderItem = (item: (typeof MERCHANT_TABS)[number]) => {
    const Icon = item.icon;
    const disabled =
      !hasStore &&
      ["products", "orders", "kitchens", "quotes"].includes(item.id);
    return (
      <button
        key={item.id}
        type="button"
        disabled={disabled}
        title={
          disabled ? "Эхлээд дэлгүүрийн мэдээллээ бүртгэнэ үү" : item.label
        }
        aria-current={active === item.id ? "page" : undefined}
        className={`dashboard-nav-button ${active === item.id ? "active" : ""}`}
        onClick={() => onChange(item.id)}
      >
        <span className="dashboard-nav-icon">
          <Icon size={19} strokeWidth={1.7} />
        </span>
        <span>{item.label}</span>
      </button>
    );
  };

  return (
    <DashboardSidebar
      open={open}
      onClose={onClose}
      label="Дэлгүүрийн удирдлагын цэс"
      id="merchant-dashboard-navigation"
    >
      <Link
        href="/"
        className="dashboard-brand merchant-sidebar-brand"
        aria-label="tavilga.mn — нүүр хуудас"
      >
        <span className="dashboard-brand-icon">
          <Armchair size={22} strokeWidth={1.7} />
        </span>
        <span className="dashboard-brand-copy">
          <strong>{storeName}</strong>
          <small>{userName} · Худалдаа эрхлэгч</small>
        </span>
      </Link>

      <nav
        className="merchant-sidebar-nav"
        aria-label="Худалдаа эрхлэгчийн цэс"
      >
        <div className="dashboard-nav-group">
          <p className="dashboard-nav-label">ДЭЛГҮҮР</p>
          {MERCHANT_TABS.slice(0, 3).map(renderItem)}
        </div>
        <div className="dashboard-nav-group">
          <p className="dashboard-nav-label">ГАЛ ТОГООНЫ MARKETPLACE</p>
          {MERCHANT_TABS.slice(3, 5).map(renderItem)}
        </div>
      </nav>

      <div className="dashboard-sidebar-bottom">
        <div className="dashboard-sidebar-note">
          <Store size={19} />
          <strong>Таны дэлгүүр, нэг дор</strong>
          <p>Бараа, захиалга болон загваруудаа эндээс удирдаарай.</p>
        </div>
        {MERCHANT_TABS.filter(
          (item) => item.id === "store" || item.id === "settings",
        ).map(renderItem)}
        <Link href="/about#contact" className="dashboard-sidebar-link">
          <CircleHelp size={18} />
          Тусламж
        </Link>
        <Link href="/" className="dashboard-sidebar-link">
          <ArrowUpRight size={18} />
          Marketplace руу очих
        </Link>
      </div>
    </DashboardSidebar>
  );
}
