import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ArrowUpRight, Box, Ruler, Heart, MapPin } from "lucide-react";
import { CATEGORIES } from "@/lib/products";
import { STORES } from "@/lib/stores";
import { INSPIRATION } from "@/lib/reviews";
import { readProducts } from "@/lib/catalogServer";
import { ProductCard } from "@/components/ProductCard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const products = await readProducts();
  const featured = [...products.filter(p => p.isBestSeller), ...products.filter(p => !p.isBestSeller)].slice(0, 8);
  const newArrivals = products.filter(p => p.isNew).slice(0, 4);
  return <div className="store-home">
    <section className="shop-container home-hero" aria-labelledby="home-title">
      <div className="hero-copy">
        <span className="eyebrow"><span className="status-dot" /> Таны гэрийн шинэ эхлэл</span>
        <h1 id="home-title">Гэр гэдэг<br />хамгийн <span>тухтай</span><br className="hero-break" /> газар.</h1>
        <p>Танд таалагдах загвар. Амьдралд тань нийцэх тавилга.<br className="hidden sm:block" /> Өөрийн орон зайг хамтдаа бүтээе.</p>
        <Link href="/catalog" className="btn-primary">Тавилга үзэх <ArrowRight size={17} /></Link>
        <Link href="/planner" className="hero-secondary">Эхлээд өрөөндөө байрлуулж үзэх <ArrowUpRight size={15} /></Link>
      </div>
      <div className="hero-image">
        <Image src="https://images.unsplash.com/photo-1615529182904-14819c35db37?auto=format&fit=crop&w=1400&q=80" alt="Байгалийн өнгө, тухтай буйдан, модон тавилгатай зочны өрөө" fill priority sizes="(max-width: 767px) 100vw, 60vw" className="object-cover" />
        <span className="hero-image-label">Өдөр бүрийн тав тух</span>
        <Link href="/catalog/sofa" className="hero-image-card"><div><span>ЗОЧНЫ ӨРӨӨ</span><strong>Тухтай мөчүүд эндээс.</strong></div><span className="circle-arrow"><ArrowUpRight size={20} /></span></Link>
      </div>
    </section>
    <div className="shop-container benefit-strip">
      {[{ icon: Box, title: "Тал бүрээс нь хараарай", text: "Тавилгаа 3D орчинд үзэх" }, { icon: Ruler, title: "Өрөөндөө тааруулаарай", text: "Хэмжээ, байрлалаа төлөвлөх" }, { icon: Heart, title: "Өөрийнхөөрөө сонгоорой", text: "Өнгө, материалын сонголт" }].map(({ icon: Icon, title, text }) => <div key={title}><Icon size={22} strokeWidth={1.5} /><div><strong>{title}</strong><span>{text}</span></div></div>)}
    </div>
    <section className="shop-container shop-section" aria-labelledby="category-title">
      <div className="section-title"><div><span className="eyebrow">Хэрэгтэй бүхнээ нэг дороос</span><h2 id="category-title">Юу хайж байна вэ?</h2></div><Link href="/catalog" className="text-link">Бүх ангилал <ArrowRight size={17} /></Link></div>
      <div className="category-grid">{CATEGORIES.map(c => <Link key={c.id} href={"/catalog/" + c.id} className="category-card"><div><Image src={c.image} alt={c.name} fill sizes="(max-width: 767px) 110px, 170px" className="object-cover" /></div><span>{c.name}</span></Link>)}</div>
    </section>
    <section className="shop-container shop-section" aria-labelledby="featured-title">
      <div className="section-title"><div><span className="eyebrow">Таны дараагийн дуртай тавилга</span><h2 id="featured-title">Онцлох сонголтууд</h2></div><Link href="/catalog" className="text-link">Бүгдийг үзэх <ArrowRight size={17} /></Link></div>
      {featured.length ? <div className="product-grid">{featured.map(p => <ProductCard key={p.id} product={p} />)}</div> : <div className="shop-empty"><Box size={32} /><h3>Шинэ сонголтууд удахгүй нэмэгдэнэ</h3><p>Ангилал болон дэлгүүрүүдтэй танилцаарай.</p><Link href="/catalog" className="btn-ghost">Каталог үзэх</Link></div>}
    </section>
    <section className="shop-container shop-section" aria-labelledby="planner-title"><div className="planner-banner"><div className="planner-banner-image"><Image src="https://images.unsplash.com/photo-1631679706909-1844bbd07221?auto=format&fit=crop&w=900&q=80" alt="Буйдан, сандлыг зохицуулан байрлуулсан зочны өрөө" fill sizes="(max-width: 767px) 100vw, 50vw" className="object-cover" /><span className="planner-tag"><Box size={16} /> 3D өрөөний төлөвлөгч</span></div><div className="planner-banner-copy"><span className="eyebrow">Худалдан авахаасаа өмнө</span><h2 id="planner-title">Танай өрөөнд<br />хэрхэн харагдах бол?</h2><p>Өрөөнийхөө хэмжээг оруулаад, тавилгаа байрлуулж үзээрэй. Өнгө, хэмжээ, зохицол — бүгдийг нэг дор.</p><Link href="/planner" className="btn-primary">Өрөөгөө төлөвлөх <ArrowUpRight size={17} /></Link></div></div></section>
    {newArrivals.length > 0 && <section className="shop-container shop-section" aria-labelledby="new-title"><div className="section-title"><div><span className="eyebrow">Шинэ санаа, шинэ мэдрэмж</span><h2 id="new-title">Шинээр нэмэгдсэн</h2></div><Link href="/catalog?sort=new" className="text-link">Бүгдийг үзэх <ArrowRight size={17} /></Link></div><div className="product-grid">{newArrivals.map(p => <ProductCard key={p.id} product={p} />)}</div></section>}
    <section className="shop-container shop-section" aria-labelledby="inspiration-title"><div className="section-title"><div><span className="eyebrow">Таны орон зай, таны хэв маяг</span><h2 id="inspiration-title">Гэртээ урам нэмээрэй</h2></div></div><div className="inspiration-grid">{INSPIRATION.slice(0, 3).map((item, i) => <Link href={"/catalog/" + ["sofa", "bed", "dining-table"][i]} key={item.id} className="inspiration-card"><div><Image src={item.src} alt={item.title} fill sizes="(max-width: 767px) 85vw, 33vw" className="object-cover" /></div><span>{item.style}</span><h3>{item.title}<ArrowUpRight size={18} /></h3></Link>)}</div></section>
    <section id="stores" className="shop-container shop-section" aria-labelledby="stores-title"><div className="section-title"><div><span className="eyebrow">Ойроос харж, мэдэрч сонгох</span><h2 id="stores-title">Дэлгүүрүүдтэй танилцах</h2></div><Link href="/about#stores" className="text-link">Байршил үзэх <ArrowRight size={17} /></Link></div><div className="store-grid">{STORES.slice(0, 4).map(s => <Link key={s.id} href={"/catalog/stores/" + s.id} className="store-tile"><span className="store-monogram">{s.name.slice(0, 1)}</span><div><h3>{s.name}</h3><span><MapPin size={13} />{s.district !== "-" ? s.district : s.city}</span></div><ArrowUpRight size={17} /></Link>)}</div></section>
  </div>;
}

