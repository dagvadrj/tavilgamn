"use client";

import Image from "next/image";
import { PlannerLink as Link } from "@/components/PlannerLink";
import { ArrowUpRight, Check } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import type { RoomLook } from "@/lib/shopTheLook";
import type { Category } from "@/lib/types";

const PURPOSE: Partial<Record<Category, string>> = {
  sofa: "Гэр бүлээрээ сууж амрах, зочдоо хүлээн авах үндсэн орон зайг бүрдүүлнэ.",
  bookshelf:
    "Ном, чимэглэлээ эмхэлж, хэрэгтэй зүйлсээ ойрхон байрлуулахад тусална.",
  "tv-stand":
    "Дэлгэц болон дагалдах хэрэгслээ нэг дор байрлуулж, үзэх хэсгийг цэгцэлнэ.",
  bed: "Унтлагын өрөөний үндсэн хэсэг болж, амрах орон зайг тодорхойлно.",
  wardrobe:
    "Хувцас, хэрэглэлээ ангилж хадгалах зай гаргаж, өрөөг эмх цэгцтэй байлгана.",
  "dining-table": "Хамтдаа хооллох, ярилцах өдөр тутмын уулзалтын төв болно.",
  "kitchen-cabinet":
    "Сав суулга, хүнсний хэрэглэлээ ангилан хадгалж, ажлын талбайг чөлөөлнө.",
  oven: "Хоол бэлтгэх хэсгийг бүрдүүлж, гал тогооны бусад тавилгатай хосолно.",
  office:
    "Ажиллах хэрэгслээ нэг дор байрлуулж, төвлөрөх тусдаа хэсэг бий болгоно.",
};

export function HomeShowcase({
  room,
  rooms = [],
  onRoomChange,
}: {
  room?: RoomLook;
  rooms?: RoomLook[];
  onRoomChange?: (id: string) => void;
}) {
  if (!room) return null;
  const products = room.products
    .filter(
      (product, index, items) =>
        items.findIndex((item) => item.category === product.category) === index,
    )
    .slice(0, 4);
  const checkedAt = Date.now();

  return (
    <section className="home-showcase" aria-labelledby="home-showcase-title">
      <header className="home-showcase-heading">
        <div>
          <span>SHOP THE LOOK / ГЭРЭЭ ТӨСӨӨЛ.</span>
          <h2 id="home-showcase-title">Өрөөгөөр нь сонгох</h2>
        </div>
        <Link href={`/catalog?room=${room.id}`}>
          Өрөөний бүх тавилга <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
      </header>
      {rooms.length > 0 && (
        <nav className="home-showcase-tabs" aria-label="Өрөөгөөр сонгох">
          {rooms.map((item) => (
            <button
              type="button"
              key={item.id}
              aria-pressed={item.id === room.id}
              onClick={() => onRoomChange?.(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      )}
      <div
        className={`home-showcase-layout${!products.length ? " home-showcase-layout--empty" : ""}`}
      >
        <div className="home-showcase-room">
          <div className="home-showcase-scene">
            <Image
              src={room.image}
              alt={`${room.label} — тавилгуудыг хослуулан байрлуулсан жишиг өрөө`}
              fill
              quality={95}
              sizes="(max-width: 1099px) 100vw, 55vw"
            />
            <span className="home-showcase-scene-label">
              {room.label} · Тохижуулалтын санаа
            </span>
            {room.hotspots
              .filter((point) =>
                products.some((product) => product.id === point.productId),
              )
              .map((point) => {
                const index = products.findIndex(
                  (product) => product.id === point.productId,
                );
                return (
                  <Link
                    key={point.productId}
                    className="home-showcase-hotspot"
                    href={`/product/${point.productId}`}
                    style={{ left: `${point.x}%`, top: `${point.y}%` }}
                    aria-label={`${products[index].name} — дэлгэрэнгүй үзэх`}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </Link>
                );
              })}
          </div>
        </div>
        {products.length > 0 && (
          <div
            className={`home-showcase-products home-showcase-products--${products.length}`}
            aria-label={`${room.label} — хослуулах тавилгууд`}
          >
            {products.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                offerCheckedAt={checkedAt}
                initialDetailsOpen={
                  products.length <= 2 || (products.length === 3 && index === 0)
                }
                imageSizes="(max-width: 539px) 100vw, (max-width: 899px) 50vw, 30vw"
              />
            ))}
          </div>
        )}
      </div>
      <div className="home-showcase-story">
        <div className="home-showcase-story-intro">
          <span className="home-showcase-eyebrow">ЗОРИУЛАЛТ БА ДАВУУ ТАЛ</span>
          <h3>Яагаад ингэж хослуулах вэ?</h3>
          <p>{room.description}</p>
        </div>
        <div className="home-showcase-benefits">
          {products.map((product, index) => (
            <div className="home-showcase-benefit" key={product.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h4>
                  <Link href={`/product/${product.id}`}>{product.name}</Link>
                </h4>
                <p>
                  {PURPOSE[product.category] ||
                    product.description ||
                    "Өрөөнийхөө хэмжээ, өнгө, хэрэгцээнд тохируулан хослуулаарай."}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="home-showcase-story-footer">
          <span>
            <Check size={14} aria-hidden="true" /> Зурагтай хослуулах каталогийн
            сонголтууд
          </span>
          <Link href="/planner">
            Өрөөндөө 3D-ээр байрлуулах{" "}
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
