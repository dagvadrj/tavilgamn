import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Manrope, Unbounded } from "next/font/google";
import "./marketplace.css";
import "./homepage-marketplace.css";

const bodyFont = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-market-body", display: "swap" });
const headingFont = Unbounded({ subsets: ["latin", "cyrillic"], variable: "--font-market-heading", display: "swap" });

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${bodyFont.variable} ${headingFont.variable} shop-shell flex min-w-0 flex-1 flex-col`}>
    <Header />
    <main id="main-content" className="min-w-0 flex-1">{children}</main>
    <Footer />
  </div>;
}
