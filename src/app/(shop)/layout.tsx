import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { StorefrontMain } from "@/components/StorefrontMain";
import "./shop-tokens.css";
import "./storefront.css";
import "./shop-the-look.css";
import "./product-experience.css";
import "./directory-search.css";
import "./exhibition.css";
import "./home-showcase.css";
import "./styles/room-style.css";
import "./styles/mobile-shop.css";
import "./styles/storefront-polish.css";



export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <div className="site-ui shop-shell flex min-w-0 flex-1 flex-col">
    <Header />
    <StorefrontMain>{children}</StorefrontMain>
    <Footer />
  </div>;
}
