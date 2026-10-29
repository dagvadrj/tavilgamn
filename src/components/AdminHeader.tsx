"use client";
import type { ReactNode } from "react";

import Link from "next/link";
import { Bell, ChevronDown, Menu, Search } from "lucide-react";

export function AdminHeader({
  activeLabel,
  themeToggle,
  create,
  slotRef,
  menuOpen,
  onToggleMenu,
  onSearch,
  onMessages,
}: {
  activeLabel: string;
  themeToggle?: ReactNode;
  create?: ReactNode;
  /** Page-owned controls (date range, export) are portalled here. */
  slotRef: (element: HTMLDivElement | null) => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onSearch: () => void;
  onMessages: () => void;
}) {
  return (
    <header className="admin-topbar dashboard-topbar">
      <button
        type="button"
        className="dashboard-menu-toggle"
        aria-label={menuOpen ? "Админ цэс хаах" : "Админ цэс нээх"}
        aria-expanded={menuOpen}
        aria-controls="admin-navigation"
        onClick={onToggleMenu}
      >
        <Menu size={18} />
      </button>
      <Link href="/" className="dashboard-workspace-switch dashboard-mobile-only" aria-label="Тавилга.mn — дэлгүүр рүү очих">
        <span className="dashboard-workspace-mark" aria-hidden="true">
          т
        </span>
        <strong>Тавилга.mn</strong>
        <ChevronDown size={14} aria-hidden="true" />
      </Link>
      <nav className="dashboard-breadcrumb" aria-label="Хуудасны зам">
        <span>Тавилга.mn</span>
        <span aria-hidden="true">/</span>
        <strong aria-current="page">{activeLabel}</strong>
      </nav>
      <div className="dashboard-topbar-slot" ref={slotRef} />
      <div className="admin-topbar-actions dashboard-header-actions">
        <button
          type="button"
          className="dashboard-icon-button dashboard-mobile-only"
          aria-label="Хайх"
          onClick={onSearch}
        >
          <Search size={17} />
        </button>
        <button
          type="button"
          className="dashboard-icon-button dashboard-mobile-only"
          aria-label="Мессеж"
          onClick={onMessages}
        >
          <Bell size={17} />
        </button>
        {themeToggle}
        {create}
      </div>
    </header>
  );
}
