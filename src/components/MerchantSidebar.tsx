"use client";

import Link from "next/link";
import {
  Armchair,
  BarChart3,
  Bot,
  ChevronDown,
  CookingPot,
  FileText,
  LayoutDashboard,
  MapPin,
  MessageSquare,
  MessageSquareQuote,
  Package,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  Undo2,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { DashboardSidebar } from "@/features/dashboard/components/DashboardSidebar";
import type { MerchantLocationTab } from "@/lib/merchantNavigation";

export type MerchantTab = MerchantLocationTab;

export const MERCHANT_TABS: {
  id: MerchantTab;
  label: string;
  icon: typeof LayoutDashboard;
}[] = [
  { id: "overview", label: "Тойм", icon: LayoutDashboard },
  { id: "sales", label: "Борлуулалт", icon: BarChart3 },
  { id: "inventory", label: "Нөөц ба бараа", icon: Package },
  { id: "progress", label: "Захиалгын явц", icon: Truck },
  { id: "activation", label: "Дэлгүүр идэвхжүүлэх", icon: ShieldCheck },
  { id: "wallet", label: "Хэтэвч, кредит", icon: Wallet },
  { id: "reports", label: "Тайлан татах", icon: BarChart3 },
  { id: "contracts", label: "Платформын гэрээ", icon: FileText },
  { id: "products", label: "Бүтээгдэхүүн", icon: Package },
  { id: "rooms", label: "Тохижуулсан өрөөнүүд", icon: Armchair },
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

/** Every merchant page stays reachable; groups follow the monochrome redesign spec. */
const MERCHANT_NAV_GROUPS: { label?: string; tabs: MerchantTab[] }[] = [
  { tabs: ["overview", "orders", "products", "delivery"] },
  { label: "Борлуулалт", tabs: ["sales", "inventory", "progress", "reports", "wallet"] },
  { label: "Дэлгүүр", tabs: ["store", "activation", "contracts", "branches", "staff", "rooms"] },
  { label: "Харилцагч", tabs: ["reviews", "returns", "assistant", "quotes", "kitchens"] },
  { label: "Систем", tabs: ["settings"] },
];
const STORE_ONLY: MerchantTab[] = [
  "sales", "inventory", "progress", "products", "rooms", "orders", "delivery", "kitchens", "quotes", "activation",
  "wallet", "reports", "contracts", "branches", "staff", "reviews", "assistant", "returns",
];

export function MerchantSidebar({
  active,
  onChange,
  hasStore,
  storeName,
  userName,
  email,
  onSearch,
  open,
  onClose,
  allowedTabs,
}: {
  active: MerchantTab;
  onChange: (tab: MerchantTab) => void;
  hasStore: boolean;
  storeName: string;
  userName: string;
  email?: string;
  onSearch?: () => void;
  open: boolean;
  onClose: () => void;
  allowedTabs?: MerchantTab[];
}) {
  const renderItem = (id: MerchantTab) => {
    if (allowedTabs && !allowedTabs.includes(id)) return null;
    const item = MERCHANT_TABS.find((tab) => tab.id === id)!;
    const Icon = item.icon;
    return (
      <button
        key={id}
        type="button"
        disabled={!hasStore && STORE_ONLY.includes(id)}
        aria-label={item.label}
        aria-current={active === id ? "page" : undefined}
        className="dashboard-nav-button"
        onClick={() => onChange(id)}
      >
        <span className="dashboard-nav-icon">
          <Icon size={16} strokeWidth={1.6} />
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
        className="dashboard-workspace-switch"
        aria-label="tavilga.mn — нүүр хуудас"
      >
        <span className="dashboard-workspace-mark" aria-hidden="true">
          {storeName.trim().charAt(0).toUpperCase() || "т"}
        </span>
        <strong>{storeName}</strong>
        <ChevronDown size={14} aria-hidden="true" />
      </Link>
      {onSearch && (
        <button type="button" className="dashboard-search" onClick={onSearch}>
          <Search size={15} aria-hidden="true" />
          <span>Хайх</span>
          <kbd>⌘K</kbd>
        </button>
      )}
      <nav
        className="merchant-sidebar-nav"
        aria-label="Худалдаа эрхлэгчийн цэс"
      >
        {MERCHANT_NAV_GROUPS.map((group) => {
          const items = group.tabs.map(renderItem).filter(Boolean);
          if (!items.length) return null;
          return (
            <div className="dashboard-nav-group" key={group.label ?? "main"}>
              {group.label && <p className="dashboard-nav-label">{group.label}</p>}
              {items}
            </div>
          );
        })}
      </nav>
      {(!allowedTabs || allowedTabs.includes("profile")) && (
        <button
          type="button"
          className="dashboard-user"
          aria-label="Миний бүртгэл"
          aria-current={active === "profile" ? "page" : undefined}
          onClick={() => onChange("profile")}
        >
          <span className="dashboard-user-avatar" aria-hidden="true">
            {userName.trim().charAt(0).toUpperCase() || "Х"}
          </span>
          <span className="dashboard-user-copy">
            <strong>{userName}</strong>
            {email && <small>{email}</small>}
          </span>
        </button>
      )}
    </DashboardSidebar>
  );
}

export { MERCHANT_NAV_GROUPS };
