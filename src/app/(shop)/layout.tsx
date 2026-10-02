import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import "./marketplace.css";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <div className="shop-shell flex min-w-0 flex-1 flex-col">
    <Header />
    <main id="main-content" className="min-w-0 flex-1">{children}</main>
    <Footer />
  </div>;
}
