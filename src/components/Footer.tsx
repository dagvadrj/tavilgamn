"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Armchair, ArrowUpRight } from "lucide-react";
import { CATEGORIES } from "@/lib/products";
export function Footer() {
  const pathname = usePathname();
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return null;
  return <footer className="store-footer"><div className="shop-container footer-main"><div className="footer-brand"><Link href="/" className="brand"><span className="brand-icon"><Armchair size={23} /></span>tavilga<span className="brand-dot">.</span>mn</Link><p>Гэртээ тухтай. Өөрийнхөөрөө.<br />Таны өдөр бүрийн амьдралд нийцэх тавилга.</p><Link href="/planner" className="text-link">Өрөөгөө хамтдаа тохижуулъя <ArrowUpRight size={16} /></Link></div><div><h2>Тавилга</h2>{CATEGORIES.slice(0, 4).map(c => <Link key={c.id} href={"/catalog/" + c.id}>{c.name}</Link>)}<Link href="/catalog">Бүх тавилга</Link></div><div><h2>Танд туслах</h2><Link href="/account">Миний бүртгэл</Link><Link href="/account">Миний захиалгууд</Link><Link href="/wishlist">Хадгалсан тавилга</Link><Link href="/about#contact">Холбоо барих</Link></div><div><h2>Бидний тухай</h2><Link href="/about">Тавилга.mn</Link><Link href="/about#stores">Дэлгүүрийн байршил</Link><Link href="/planner">3D өрөөний төлөвлөгч</Link></div></div><div className="shop-container footer-bottom"><p>© {new Date().getFullYear()} tavilga.mn. Бүх эрх хуулиар хамгаалагдсан.</p><span>Таны гэрийн тав тухын төлөө.</span></div></footer>;
}

