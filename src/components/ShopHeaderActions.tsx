"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Heart, ShoppingBag, UserRound, House, LayoutGrid } from "lucide-react";
import { useCart } from "@/store/cart";
import { useWishlist } from "@/store/wishlist";
import { useAuth } from "@/store/auth";
import { CategoryMenu } from "./CategoryMenu";

export function ShopRoleLinks() {
  const role = useAuth(state => state.role);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  if (role === "admin") return <Link href="/admin">Удирдлага</Link>;
  if (role === "merchant") return <Link href="/merchant">Миний дэлгүүр</Link>;
  return null;
}

export function ShopHeaderActions() {
  const cartCount = useCart(state => state.count());
  const wishCount = useWishlist(state => state.items.length);
  const user = useAuth(state => state.user);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return <nav className="header-actions" aria-label="Хэрэглэгчийн цэс">
    <Link href={mounted && user ? "/account" : "/login"} className="header-action account-action">
      <UserRound size={21} aria-hidden="true" /><span>{mounted && user ? "Миний бүртгэл" : "Нэвтрэх"}</span>
    </Link>
    <Link href="/wishlist" className="header-action saved-action" aria-label={`Хадгалсан${mounted && wishCount ? ` · ${wishCount}` : ""}`}>
      <span className="nav-icon"><Heart size={21} aria-hidden="true" />{mounted && wishCount > 0 && <b className="nav-count">{wishCount > 99 ? "99+" : wishCount}</b>}</span><span>Хадгалсан</span>
    </Link>
    <Link href="/cart" className="header-action cart-action" aria-label={`Сагс · ${mounted ? cartCount : 0} бараа`}>
      <span className="nav-icon"><ShoppingBag size={21} aria-hidden="true" /><b className="nav-count">{mounted ? cartCount > 99 ? "99+" : cartCount : 0}</b></span><span>Сагс</span>
    </Link>
  </nav>;
}

/** Preserve the existing mobile category dialog and authenticated role shortcuts. */
export function MobileShopNavigation() {
  const pathname = usePathname();
  const count = useCart(state => state.count());
  const wishes = useWishlist(state => state.items.length);
  const user = useAuth(state => state.user);
  const role = useAuth(state => state.role);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => setOpen(false), [pathname]);
  const links = [
    { href: "/", label: "Нүүр", Icon: House, count: 0, active: pathname === "/" },
    { href: "/catalog", label: "Ангилал", Icon: LayoutGrid, count: 0, active: pathname.startsWith("/catalog") || pathname.startsWith("/product") },
    { href: "/wishlist", label: "Хадгалсан", Icon: Heart, count: wishes, active: pathname === "/wishlist" },
    { href: "/cart", label: "Сагс", Icon: ShoppingBag, count, active: pathname === "/cart" || pathname === "/checkout" },
    { href: mounted && user ? "/account" : "/login", label: "Миний", Icon: UserRound, count: 0, active: ["/account", "/login", "/register"].includes(pathname) || pathname.startsWith("/orders") },
  ];
  return <>
    <nav className="mobile-bottom-nav" aria-label="Доод үндсэн цэс">
      {links.map(({ href, label, Icon, count: badge, active }) => label === "Ангилал"
        ? <button key={href} type="button" className={`mobile-category-trigger${active || open ? " active" : ""}`} onClick={() => setOpen(true)}
          aria-expanded={open} aria-controls="category-menu" aria-haspopup="dialog"><Icon size={21} aria-hidden="true" /><span>{label}</span></button>
        : <Link key={href} href={href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
          <span className="nav-icon"><Icon size={21} aria-hidden="true" />{mounted && badge > 0 && <b className="nav-count">{badge > 99 ? "99+" : badge}</b>}</span><span>{label}</span>
        </Link>)}
    </nav>
    <CategoryMenu open={open} onClose={() => setOpen(false)} merchant={mounted && role === "merchant"} admin={mounted && role === "admin"} />
  </>;
}
