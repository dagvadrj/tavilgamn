import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Factory, Hammer, MapPin, Store as StoreIcon } from "lucide-react";
import { readStoreDirectory } from "@/lib/storeDirectory";
import { STORE_TYPES, isStoreType } from "@/lib/storeTypes";
import { CATEGORY_LABEL } from "@/lib/products";

export const dynamic = "force-dynamic";
export const metadata = { title: "Дэлгүүрүүд — tavilga.mn" };
const typeIcons = { factory: Factory, handmade: Hammer, retail: StoreIcon };

export default async function StoresPage({ searchParams }: { searchParams: { type?: string } }) {
  const selected = isStoreType(searchParams.type) ? searchParams.type : undefined;
  const activeType = STORE_TYPES.find(type => type.id === selected);
  const directory = await readStoreDirectory();
  const stores = directory.filter(store => !selected || store.storeType === selected);
  return (
    <div className="shop-container py-8 sm:py-12">
      <nav aria-label="Хуудасны зам" className="breadcrumbs"><Link href="/">Нүүр</Link><span>/</span><span>Дэлгүүрүүд</span></nav>
      <header className="mb-8 max-w-2xl">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-[#6C726B]">Таны тавилгыг бүтээх хүмүүс</p>
        <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">{activeType?.label ?? "Дэлгүүрүүд"}</h1>
        <p className="mt-3 text-sm leading-6 text-[#6C726B]">{activeType?.description ?? "Үйлдвэр, урлаач, бэлэн тавилгын дэлгүүрээс өөрт тохирохыг сонгоорой."}</p>
      </header>
      <nav aria-label="Дэлгүүрийн төрөл" className="mb-8 flex flex-wrap gap-2">
        <Link href="/stores" aria-current={!selected ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm ${!selected ? "border-[#293C32] bg-[#293C32] text-white" : "border-[#293C32]/15 bg-white"}`}>Бүх дэлгүүр · {directory.length}</Link>
        {STORE_TYPES.map(type => {
          const Icon = typeIcons[type.id];
          return <Link key={type.id} href={`/stores?type=${type.id}`} aria-current={selected === type.id ? "page" : undefined} className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm ${selected === type.id ? "border-[#293C32] bg-[#293C32] text-white" : "border-[#293C32]/15 bg-white hover:bg-[#F2F4EF]"}`}><Icon size={16} aria-hidden="true" />{type.label}<span className="opacity-70">{directory.filter(store => store.storeType === type.id).length}</span></Link>;
        })}
      </nav>
      {stores.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#293C32]/20 bg-white px-6 py-16 text-center">
          <Hammer size={32} aria-hidden="true" className="mx-auto mb-4 text-[#42634F]" />
          <h2 className="text-xl font-medium">Энэ төрөлд дэлгүүр хараахан нэмэгдээгүй байна</h2>
          <p className="mt-3 text-sm text-[#6C726B]">Шинэ дэлгүүр бүртгэгдмэгц энд харагдана.</p>
          <Link href="/stores" className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4">Бүх дэлгүүрийг үзэх <ArrowUpRight size={16} /></Link>
        </div>
      ) : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {stores.map(store => <Link key={store.id} href={`/catalog/stores/${store.id}`} className="group overflow-hidden rounded-2xl border border-[#293C32]/10 bg-white transition hover:border-[#42634F]/40 hover:shadow-sm">
          <div className="relative aspect-[16/9] overflow-hidden bg-[#EDF0E9]">
            {store.image ? <Image src={store.image} alt="" fill unoptimized sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover transition duration-300 group-hover:scale-[1.03]" /> : <StoreIcon aria-hidden="true" className="absolute inset-0 m-auto h-12 w-12 text-[#42634F]/50" />}
            <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium">{STORE_TYPES.find(type => type.id === store.storeType)?.label}</span>
          </div>
          <div className="p-5">
            <div className="flex items-start justify-between gap-3"><h2 className="text-lg font-semibold leading-6">{store.name}</h2><ArrowUpRight size={20} className="shrink-0 text-[#42634F]" aria-hidden="true" /></div>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-[#6C726B]"><MapPin size={14} aria-hidden="true" />{[store.city, store.district !== "-" && store.district].filter(Boolean).join(" · ")}</p>
            <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#6C726B]">{store.description}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">{store.categories.slice(0, 3).map(category => <span key={category} className="rounded-md bg-[#F2F4EF] px-2 py-1 text-[11px] text-[#42634F]">{CATEGORY_LABEL[category]}</span>)}</div>
          </div>
        </Link>)}
      </div>}
    </div>
  );
}
