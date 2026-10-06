import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Manrope } from "next/font/google";
import "./shop-tokens.css";
import "./storefront.css";
import "./shop-the-look.css";
import "./product-experience.css";

const bodyFont = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-market-body", display: "swap" });


export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${bodyFont.variable} shop-shell flex min-w-0 flex-1 flex-col`}>
    <Header />
    <main id="main-content" className="min-w-0 flex-1">{children}</main>
    <Footer />
  </div>;
}
