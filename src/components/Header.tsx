import Link from "next/link";
import { Armchair, Search, ChevronDown } from "lucide-react";
import { CATEGORIES } from "@/lib/products";
import { ShopHeaderActions, MobileShopNavigation, ShopRoleLinks } from "./ShopHeaderActions";

export function Header() {
  return <>
    <div className="store-announcement">
      <div className="shop-container market-utility">
        <div><Link href="/merchant">Дэлгүүр нээх</Link><Link href="/about#contact">Тусламж</Link></div>
        <span lang="mn">Монгол <span aria-hidden="true">·</span> ₮ MNT</span>
      </div>
    </div>
    <header className="store-header">
      <div className="shop-container header-main">
        <Link href="/" className="brand" aria-label="Тавилга.mn — Нүүр">
          <Armchair size={27} strokeWidth={1.7} aria-hidden="true" /><span>Тавилга<span className="brand-dot">.</span></span>
        </Link>
        <form action="/catalog" method="get" role="search" className="store-search">
          <label className="search-category"><span className="sr-only">Хайлтын ангилал</span>
            <select name="category" defaultValue="" aria-label="Хайлтын ангилал">
              <option value="">Бүх ангилал</option>
              {CATEGORIES.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select><ChevronDown size={13} aria-hidden="true" />
          </label>
          <input type="search" name="q" aria-label="Тавилга хайх" placeholder="Тавилга, загвар, ангилал хайх…" />
          <button type="submit" aria-label="Хайх"><Search size={18} aria-hidden="true" /><span>Хайх</span></button>
        </form>
        <ShopHeaderActions />
      </div>
      <div className="market-nav-surface">
        <nav className="shop-container desktop-nav" aria-label="Үндсэн цэс">
          <Link href="/catalog?offers=1" className="market-sale-link">Хямдрал</Link>
          <Link href="/catalog?sort=new">Шинэ</Link>
          {CATEGORIES.map(category => <Link key={category.id} href={`/catalog/${category.id}`}>{category.name}</Link>)}
          <Link href="/planner">3D төлөвлөгч</Link>
          <Link href="/stores">Дэлгүүрүүд</Link>
          <Link href="/kitchen">Гал тогоо төлөвлөх</Link>
          <Link href="/kitchens">Бэлэн гал тогоо</Link>
          <ShopRoleLinks />
        </nav>
      </div>
    </header>
    <MobileShopNavigation />
  </>;
}
