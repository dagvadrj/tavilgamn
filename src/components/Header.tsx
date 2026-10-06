import Link from "next/link";
import { ProductSearch } from "./ProductSearch";
import { ShopHeaderActions, MobileShopNavigation, ShopRoleLinks } from "./ShopHeaderActions";

export function Header() {
  return <>
    <header className="store-header">
      <div className="shop-container header-main">
        <Link href="/" className="brand" aria-label="Тавилга.mn — Нүүр">TAVILGA<span className="brand-dot" aria-hidden="true">●</span></Link>
        <nav className="desktop-nav studio-navigation" aria-label="Үндсэн цэс">
          <Link href="/catalog">Каталог</Link>
          <Link href="/planner">3D Төлөвлөгч</Link>
          <Link href="/kitchens">Гал тогоо</Link>
          <Link href="/stores">Дэлгүүрүүд</Link>
          <ShopRoleLinks />
        </nav>
        <ProductSearch />
        <ShopHeaderActions />
      </div>
    </header>
    <MobileShopNavigation />
  </>;
}
