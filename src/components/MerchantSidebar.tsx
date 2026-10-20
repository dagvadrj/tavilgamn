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
  UserRound,
  Truck,
  Wallet,
  ShieldCheck,
  MapPin, Users, MessageSquare, Bot, Undo2,
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
  { id: "activation", label: "Дэлгүүр идэвхжүүлэх", icon: ShieldCheck },
  { id: "wallet", label: "Хэтэвч, кредит", icon: Wallet },
  { id: "products", label: "Бүтээгдэхүүн", icon: Package },
  { id: "orders", label: "Захиалгууд", icon: ShoppingBag },
  { id: "delivery", label: "Хүргэлт", icon: Truck },
  { id: "branches", label: "Салбар, агуулах", icon: MapPin },
  { id: "staff", label: "Ажилтны эрх", icon: Users },
  { id: "reviews", label: "Сэтгэгдэл хянах", icon: MessageSquare },
  { id: "assistant", label: "AI туслах / FAQ", icon: Bot },
  { id: "returns", label: "Буцаалт, гомдол", icon: Undo2 },
  { id: "kitchens", label: "Гал тогооны загвар", icon: CookingPot },
  { id: "quotes", label: "Үнийн хүсэлтүүд", icon: MessageSquareQuote },
  { id: "store", label: "Дэлгүүрийн мэдээлэл", icon: Store },
  { id: "settings", label: "Самбарын тохиргоо", icon: Settings },
  { id: "profile", label: "Миний бүртгэл", icon: UserRound },
];

export function MerchantSidebar({
  active,
  onChange,
  hasStore,
  storeName,
  userName,
  open,
  onClose,
  allowedTabs,
}: {
  active: MerchantTab;
  onChange: (tab: MerchantTab) => void;
  hasStore: boolean;
  storeName: string;
  userName: string;
  open: boolean;
  onClose: () => void;
  allowedTabs?: MerchantTab[];
}) {
  const renderItem = (item: (typeof MERCHANT_TABS)[number]) => {
    if (allowedTabs && !allowedTabs.includes(item.id)) return null;
    const Icon = item.icon;
    const disabled =
      !hasStore &&
      [
        "products",
        "orders",
        "delivery",
        "kitchens",
        "quotes",
        "activation",
        "wallet",
        "branches", "staff", "reviews", "assistant", "returns",
      ].includes(item.id);
    return (
      <button
        key={item.id}
        type="button"
        disabled={disabled}
        aria-label={item.label}
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
          {MERCHANT_TABS.filter((item) =>
            [
              "overview",
              "activation",
              "wallet",
              "products",
              "orders",
              "delivery",
              "branches", "staff", "reviews", "assistant", "returns",
            ].includes(item.id),
          ).map(renderItem)}
        </div>
        <div className="dashboard-nav-group">
          <p className="dashboard-nav-label">ГАЛ ТОГООНЫ MARKETPLACE</p>
          {MERCHANT_TABS.filter((item) =>
            ["kitchens", "quotes"].includes(item.id),
          ).map(renderItem)}
        </div>
      </nav>

      <div className="dashboard-sidebar-bottom">
        <div className="dashboard-sidebar-note">
          <Store size={19} />
          <strong>Таны дэлгүүр, нэг дор</strong>
          <p>Бараа, захиалга болон загваруудаа эндээс удирдаарай.</p>
        </div>
        {MERCHANT_TABS.filter((item) =>
          ["store", "settings", "profile"].includes(item.id),
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
