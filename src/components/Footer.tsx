import Link from "next/link";
import { Armchair } from "lucide-react";
import { configuredPaymentLabels } from "@/lib/paymentPresentationServer";
import { Suspense } from "react";
import { FooterContact } from "./FooterContact";
import { SITE_CONTACT, phoneHref } from "@/lib/siteContact";

export function Footer() {
  const paymentLabels = configuredPaymentLabels();
  return (
    <footer className="store-footer">
      <div className="shop-container footer-main">
        <div className="footer-brand" id="about">
          <Link href="/" className="brand">
            <Armchair size={27} aria-hidden="true" />
            <span>
              Тавилга<span className="brand-dot">.</span>
            </span>
          </Link>
          <p>
            Гэрт хэрэгтэй тавилга, найдвартай сонголт. Дэлгүүрүүдийн үнэ,
            хэмжээ, материалыг нэг дор харьцуулаарай.
          </p>
          <span className="footer-payment">
            {paymentLabels.length
              ? paymentLabels.join(" · ")
              : "Төлбөрийн тохиргоо хүлээгдэж байна"}
          </span>
          <small>Карт / зээлийн төлбөр — тун удахгүй</small>
        </div>
        <div>
          <h2>Худалдан авагчид</h2>
          <Link href="/catalog">Бүх бараа</Link>
          <Link href="/catalog?offers=1">Хямдрал, урамшуулал</Link>
          <Link href="/account">Миний захиалгууд</Link>
          <Link href="/wishlist">Хадгалсан бараа</Link>
          <Link href="/#contact">Хүргэлт, буцаалтын тусламж</Link>
        </div>
        <div>
          <h2>Худалдагчид</h2>
          <Link href="/merchant">Дэлгүүр нээх</Link>
          <Link href="/merchant">Дэлгүүрээ удирдах</Link>
          <Link href="/stores">Дэлгүүрийн лавлах</Link>
          <Link href="/kitchens">Гал тогооны загварууд</Link>
        </div>
        <div>
          <h2>Бидний тухай</h2>
          <Link href="/#about">Тавилга.mn</Link>
          <Link href="/#contact">Холбоо барих</Link>
          <Link href="/stores">Дэлгүүрийн байршил</Link>
          <Link href="/account">Миний бүртгэл</Link>
        </div>
      </div>
      <section
        id="contact"
        className="shop-container scroll-mt-24 border-t border-current/15 py-6"
        aria-labelledby="footer-contact-heading"
      >
        <h2 id="footer-contact-heading" className="text-sm font-semibold">
          Холбоо барих, тусламж авах
        </h2>
        <p className="mt-2 text-sm opacity-80">
          Хүргэлт, буцаалт, дэлгүүр бүртгүүлэх болон сурталчилгааны хүсэлтээ
          илгээгээрэй.
        </p>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <a
            className="inline-flex min-h-11 items-center underline"
            href={phoneHref(SITE_CONTACT.phone)}
          >
            {SITE_CONTACT.phone}
          </a>
          {SITE_CONTACT.email && (
            <a
              className="inline-flex min-h-11 items-center break-all underline"
              href={`mailto:${SITE_CONTACT.email}`}
            >
              {SITE_CONTACT.email}
            </a>
          )}
        </div>
        <Suspense fallback={null}>
          <FooterContact />
        </Suspense>
      </section>
      <div className="shop-container footer-bottom">
        <p>
          © {new Date().getFullYear()} Тавилга.mn. Бүх эрх хуулиар
          хамгаалагдсан.
        </p>
        <span>Монгол · ₮ MNT</span>
      </div>
    </footer>
  );
}
