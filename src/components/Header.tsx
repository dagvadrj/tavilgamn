"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Heart, Search, ShoppingBag, UserRound, House, LayoutGrid, Armchair, ArrowUpRight, MapPin } from "lucide-react";
import { useCart } from "@/store/cart";
import { useWishlist } from "@/store/wishlist";
import { useAuth } from "@/store/auth";
import { CATEGORIES } from "@/lib/products";

export function Header() {
  const pathname = usePathname();
  const cartCount = useCart(s => s.count());
  const wishCount = useWishlist(s => s.items.length);
  const user = useAuth(s => s.user);
  const role = useAuth(s => s.role);
  const initialize = useAuth(s => s.initialize);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); void initialize(); }, [initialize]);
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return null;
  const accountHref = mounted && user ? "/account" : "/login";
  const links = [
    { href: "/", label: "Нүүр", icon: House, active: pathname === "/", count: 0 },
    { href: "/catalog", label: "Ангилал", icon: LayoutGrid, active: pathname.startsWith("/catalog") || pathname.startsWith("/product"), count: 0 },
    { href: "/wishlist", label: "Хадгалсан", icon: Heart, active: pathname === "/wishlist", count: wishCount },
    { href: "/cart", label: "Сагс", icon: ShoppingBag, active: pathname === "/cart" || pathname === "/checkout", count: cartCount },
    { href: accountHref, label: "Миний", icon: UserRound, active: ["/account", "/login", "/register"].includes(pathname) || pathname.startsWith("/orders"), count: 0 },
  ];
  return <>
    <div className="store-announcement"><div className="shop-container"><span>Гэртээ тухтай. Өөрийнхөөрөө.</span><Link href="/about#stores"><MapPin size={13} /> Дэлгүүрүүдтэй танилцах <ArrowUpRight size={13} /></Link></div></div>
    <header className="store-header">
      <div className="shop-container header-main">
        <Link href="/" className="brand" aria-label="Тавилга.mn — Нүүр"><span className="brand-icon"><Armchair size={23} strokeWidth={1.7} /></span>tavilga<span className="brand-dot">.</span>mn</Link>
        <form action="/catalog" method="get" role="search" className="store-search"><Search size={19} aria-hidden="true" /><input key={pathname} type="search" name="q" aria-label="Тавилга хайх" placeholder="Гэртээ юу хайж байна вэ?" /><button type="submit" aria-label="Хайх"><ArrowUpRight size={19} /></button></form>
        <div className="header-actions">
          {links.slice(2, 4).map(({ href, label, icon: Icon, count }) => <Link key={href} href={href} className="header-action" aria-label={label}><span className="nav-icon"><Icon size={21} strokeWidth={1.7} />{mounted && count > 0 && <span className="nav-count">{count > 99 ? "99+" : count}</span>}</span><span>{label}</span></Link>)}
          <Link href={accountHref} className="header-action account-action"><UserRound size={21} strokeWidth={1.7} /><span>{mounted && user ? "Миний бүртгэл" : "Нэвтрэх"}</span></Link>
        </div>
        <Link href="/planner" className="mobile-planner"><Armchair size={17} /> 3D өрөө</Link>
      </div>
      <nav className="shop-container desktop-nav" aria-label="Үндсэн цэс">
        <Link href="/catalog" className={pathname === "/catalog" ? "active" : ""}><LayoutGrid size={16} /> Бүх тавилга</Link>
        {CATEGORIES.map(c => <Link key={c.id} href={"/catalog/" + c.id} className={pathname === "/catalog/" + c.id ? "active" : ""}>{c.name}</Link>)}
        <Link href="/planner" className="planner-link">Өрөөгөө төлөвлөх <ArrowUpRight size={15} /></Link>
        {mounted && role === "admin" && <Link href="/admin">Удирдлага</Link>}
      </nav>
    </header>
    <nav className="mobile-bottom-nav" aria-label="Доод үндсэн цэс">
      {links.map(({ href, label, icon: Icon, active, count }) => <Link key={href} href={href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}><span className="nav-icon"><Icon size={22} strokeWidth={active ? 2 : 1.7} />{mounted && count > 0 && <span className="nav-count">{count > 99 ? "99+" : count}</span>}</span><span>{label}</span></Link>)}
    </nav>
  </>;
}

