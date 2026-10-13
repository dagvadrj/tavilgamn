import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";

export default function NotFound() {
  return (
    <main id="main-content" className="site-ui flex min-h-dvh flex-1 items-center justify-center">
      <section className="ui-empty">
        <Search size={36} className="text-ui-accent" aria-hidden="true" />
        <span className="ui-eyebrow">404 · TAVILGA.MN</span>
        <h1>Хуудас олдсонгүй</h1>
        <p>Холбоос өөрчлөгдсөн эсвэл энэ хуудас байхгүй байна. Нүүр хуудас руу буцаж эсвэл каталогоос хайгаарай.</p>
        <Link href="/" className="btn-primary"><ArrowLeft size={16} /> Нүүр хуудас</Link>
        <Link href="/catalog" className="text-sm text-ui-accent underline underline-offset-4">Каталог үзэх</Link>
      </section>
    </main>
  );
}
