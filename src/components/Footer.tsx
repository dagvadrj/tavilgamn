import Link from "next/link";
import { Armchair } from "lucide-react";
import { configuredPaymentLabels } from "@/lib/paymentPresentationServer";

export function Footer() {
  const paymentLabels = configuredPaymentLabels();
  return <footer className="store-footer">
    <div className="shop-container footer-main">
      <div className="footer-brand">
        <Link href="/" className="brand"><Armchair size={27} aria-hidden="true" /><span>Тавилга<span className="brand-dot">.</span></span></Link>
        <p>Гэрт хэрэгтэй тавилга, найдвартай сонголт. Дэлгүүрүүдийн үнэ, хэмжээ, материалыг нэг дор харьцуулаарай.</p>
        <span className="footer-payment">{paymentLabels.length ? paymentLabels.join(" · ") : "Төлбөрийн тохиргоо хүлээгдэж байна"}</span>
        <small>Карт / зээлийн төлбөр — тун удахгүй</small>
      </div>
      <div><h2>Худалдан авагчид</h2>
        <Link href="/catalog">Бүх бараа</Link><Link href="/catalog?offers=1">Хямдрал, урамшуулал</Link>
        <Link href="/account">Миний захиалгууд</Link><Link href="/wishlist">Хадгалсан бараа</Link><Link href="/about#contact">Хүргэлт, буцаалтын тусламж</Link>
      </div>
      <div><h2>Худалдагчид</h2>
        <Link href="/merchant">Дэлгүүр нээх</Link><Link href="/merchant">Дэлгүүрээ удирдах</Link>
        <Link href="/stores">Дэлгүүрийн лавлах</Link><Link href="/kitchens">Гал тогооны загварууд</Link>
      </div>
      <div><h2>Бидний тухай</h2>
        <Link href="/about">Тавилга.mn</Link><Link href="/about#contact">Холбоо барих</Link>
        <Link href="/stores">Дэлгүүрийн байршил</Link><Link href="/account">Миний бүртгэл</Link>
      </div>
    </div>
    <div className="shop-container footer-bottom">
      <p>© {new Date().getFullYear()} Тавилга.mn. Бүх эрх хуулиар хамгаалагдсан.</p><span>Монгол · ₮ MNT</span>
    </div>
  </footer>;
}
