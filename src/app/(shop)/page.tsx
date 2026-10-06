import Link from "next/link";
import Form from "next/form";
import Image from "next/image";
import {
  ArrowRight,
  ArrowUpRight,
  Armchair,
  Box,
  ChevronRight,
  CreditCard,
  LayoutGrid,
  RotateCcw,
  Store,
  Truck,
  Zap,
} from "lucide-react";
import { CATEGORIES } from "@/lib/products";
import { readStoreDirectory } from "@/lib/storeDirectory";
import { readProducts } from "@/lib/catalogServer";
import { ProductCard } from "@/components/ProductCard";
import { hasAvailableStock } from "@/lib/inventory";
import { FeaturedMerchants } from "@/components/FeaturedMerchants";
import { hasProductOffer } from "@/lib/catalogPresentation";
import {
  defaultCartSelection,
  hasProductPhoto,
  marketplacePrice,
} from "@/lib/homeMarketplace";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/orders";
import { HomeCarousel } from "@/components/HomeCarousel";
import { configuredPaymentLabels } from "@/lib/paymentPresentationServer";
import { ShopTheLook } from "@/components/ShopTheLook";
import { buildRoomLooks } from "@/lib/shopTheLook";
export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams = Promise.resolve({}),
}: {
  searchParams?: Promise<{ limit?: string }>;
}) {
  const [catalog, stores, filters] = await Promise.all([
    readProducts(),
    readStoreDirectory(),
    searchParams,
  ]);
  const products = catalog.filter(hasAvailableStock).filter(hasProductPhoto);
  const recommended = [
    ...products.filter((product) => product.isBestSeller),
    ...products.filter((product) => !product.isBestSeller),
  ];
  const parsedLimit = Number(filters.limit);
  const limit =
    Number.isInteger(parsedLimit) && parsedLimit >= 10
      ? Math.min(parsedLimit, 100)
      : 10;
  const featured = recommended.slice(0, limit);
  const offerCheckedAt = Date.now();
  const paymentLabels = configuredPaymentLabels();
  const offers = products.filter((product) =>
    hasProductOffer(
      {
        ...product,
        basePrice:
          defaultCartSelection(product)?.unitPrice ?? product.basePrice,
      },
      offerCheckedAt,
    ),
  );
  const dailyProducts = (offers.length ? offers : recommended).slice(0, 8);
  const slides = [
    {
      category: "sofa",
      eyebrow: "ГЭРТЭЭ ТУХТАЙ",
      title: "Таны гэр.\nТаны сонголт.",
      text: "Хэмжээ, өнгө, үнээ харьцуулж, өөрт тохирох тавилгаа олоорой.",
      cta: "Тавилга үзэх",
      href: "/catalog",
      tone: "blue",
    },
    {
      category: "bed",
      eyebrow: "АМРАХ ОРОН ЗАЙ",
      title: "Тухтай унтлагын\nөрөөгөө бүрдүүл.",
      text: "Ор, шүүгээ, хадгалах шийдлүүдийг нэг дороос сонгоорой.",
      cta: "Унтлагын өрөө",
      href: "/catalog/bed",
      tone: "warm",
    },
    {
      category: "dining-table",
      eyebrow: "ХАМТДАА БАЙХ МӨЧ",
      title: "Халуун дулаан\nуулзалтын төв.",
      text: "Гэр бүлийн ширээ, сандлын бодит сонголтуудтай танилцаарай.",
      cta: "Ширээ, сандал",
      href: "/catalog/dining-table",
      tone: "green",
    },
  ];

  return (
    <div className="store-home market-home">
      <div className="shop-container market-home-content">
        <h1 id="home-title" className="sr-only">
          Тавилга — гэрт хэрэгтэй бүх сонголт
        </h1>
        <ShopTheLook rooms={buildRoomLooks(catalog)} />
        <section
          className="market-hero-row"
          aria-label="Тавилгын ангилал, онцлох сонголтууд"
        >
          <nav className="market-category-list" aria-label="Барааны ангилал">
            <h2>
              <LayoutGrid size={16} aria-hidden="true" />
              Бүх ангилал
            </h2>
            {CATEGORIES.map((category) => (
              <Link key={category.id} href={`/catalog/${category.id}`}>
                <span>{category.name}</span>
                <ChevronRight size={14} aria-hidden="true" />
              </Link>
            ))}
            <Link className="market-category-all" href="/catalog">
              Бүх бараа үзэх
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </nav>
          <HomeCarousel>
            {slides.map((slide) => {
              const product = recommended.find(
                (item) => item.category === slide.category,
              );
              const category = CATEGORIES.find(
                (item) => item.id === slide.category,
              )!;
              return (
                <div
                  key={slide.category}
                  className={`market-hero-slide market-hero-${slide.tone}`}
                >
                  <div className="market-hero-copy">
                    <span className="market-eyebrow">{slide.eyebrow}</span>
                    <h2>{slide.title}</h2>
                    <p>{slide.text}</p>
                    <Link href={slide.href} className="market-cta">
                      {slide.cta}
                      <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                  </div>
                  <div className="market-hero-photo">
                    <Image
                      src={product?.image ?? category.image}
                      alt={product?.name ?? category.name}
                      fill
                      sizes="(max-width: 639px) 90vw, (max-width: 999px) 45vw, 320px"
                      className="object-cover"
                    />
                    {product && (
                      <Link
                        className="market-hero-product"
                        href={`/product/${product.id}`}
                      >
                        <span>{product.name}</span>
                        <strong>
                          {marketplacePrice(
                            defaultCartSelection(product)?.unitPrice ??
                              product.basePrice,
                          )}
                        </strong>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </HomeCarousel>
          <aside className="market-hero-promos" aria-label="Нэмэлт боломжууд">
            <Link href="/planner" className="market-promo market-planner-promo">
              <Box size={28} strokeWidth={1.5} aria-hidden="true" />
              <h2>3D төлөвлөгч</h2>
              <p>Авахаасаа өмнө өрөөндөө байрлуулж үзээрэй.</p>
              <span>
                Өрөөгөө төлөвлөх
                <ArrowUpRight size={16} aria-hidden="true" />
              </span>
            </Link>
            <Link href="/stores" className="market-promo market-stores-promo">
              <Store size={24} strokeWidth={1.5} aria-hidden="true" />
              <h2>Шинэ дэлгүүрүүд</h2>
              <p>Үйлдвэр, дэлгүүрүүдийн сонголтыг нэг дороос.</p>
              <span>
                Дэлгүүрүүдтэй танилцах
                <ArrowRight size={15} aria-hidden="true" />
              </span>
            </Link>
          </aside>
        </section>

        <section
          className="market-panel market-browse"
          aria-labelledby="browse-title"
        >
          <div className="market-section-heading">
            <div>
              <h2 id="browse-title">Та юу хайж байна вэ?</h2>
              <p>Гэрийнхээ орон зай бүрд тохирох сонголтыг олоорой.</p>
            </div>
            <Link href="/catalog">
              Бүх тавилга
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <nav
            className="market-category-tiles"
            aria-label="Зурагтай ангиллууд"
          >
            {CATEGORIES.map((category) => (
              <Link
                key={category.id}
                href={`/catalog/${category.id}`}
                className="market-category-tile"
              >
                <span className="market-category-image">
                  <Image
                    src={category.image}
                    alt=""
                    fill
                    sizes="(max-width: 639px) 104px, 128px"
                  />
                </span>
                <span>{category.name}</span>
              </Link>
            ))}
          </nav>
        </section>

        <section
          className="market-service-strip"
          aria-label="Худалдан авалтын нөхцөл"
        >
          <div>
            <Truck size={23} aria-hidden="true" />
            <div>
              <h2>Үнэгүй хүргэлт</h2>
              <p>{marketplacePrice(FREE_SHIPPING_THRESHOLD)}-өөс дээш</p>
            </div>
          </div>
          <div>
            <RotateCcw size={23} aria-hidden="true" />
            <div>
              <h2>Буцаалтын хүсэлт</h2>
              <p>Захиалгын дэлгэрэнгүйгээс</p>
            </div>
          </div>
          <div>
            <CreditCard size={23} aria-hidden="true" />
            <div>
              <h2>Төлбөрийн сонголт</h2>
              <p>
                {paymentLabels.length
                  ? paymentLabels.join(" · ")
                  : "Төлбөрийн тохиргоо хүлээгдэж байна"}
              </p>
              <small>Карт / зээл — тун удахгүй</small>
            </div>
          </div>
          <div>
            <Store size={23} aria-hidden="true" />
            <div>
              <h2>Бүртгэлтэй дэлгүүр</h2>
              <p>Үнэ, нөхцөлийг харьцуулах</p>
            </div>
          </div>
        </section>
        {dailyProducts.length > 0 && (
          <section
            className="market-panel market-daily"
            aria-labelledby={offers.length ? "offers-title" : "daily-title"}
          >
            <div className="market-section-heading market-daily-heading">
              <div>
                <h2 id={offers.length ? "offers-title" : "daily-title"}>
                  <Zap size={19} fill="currentColor" aria-hidden="true" />
                  {offers.length ? "Хямдрал, урамшуулал" : "Өнөөдрийн сонголт"}
                </h2>
                <p>
                  {offers.length
                    ? "Дэлгүүрүүдийн идэвхтэй санал"
                    : "Танд зориулж сонгосон, үлдэгдэлтэй тавилгууд"}
                </p>
              </div>
              <Link href={offers.length ? "/catalog?offers=1" : "/catalog"}>
                Бүгдийг үзэх
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
            <div
              className="market-flash-track"
              role="region"
              aria-label={
                offers.length ? "Хямдралтай бараанууд" : "Өнөөдрийн бараанууд"
              }
              tabIndex={0}
            >
              {dailyProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  offerCheckedAt={offerCheckedAt}
                  flashSale
                />
              ))}
            </div>
          </section>
        )}

        <section
          id="recommendations"
          className="market-panel market-recommendations"
          aria-labelledby="recommendations-title"
        >
          <div className="market-section-heading">
            <div>
              <h2 id="recommendations-title">
                <Armchair size={19} aria-hidden="true" />
                Танд санал болгох
              </h2>
              <p>Тав тухтай гэрийн бодит сонголтууд</p>
            </div>
            <Link href="/catalog">
              Бүх бараа
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
          {featured.length > 0 ? (
            <>
              <div className="market-product-grid">
                {featured.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    offerCheckedAt={offerCheckedAt}
                  />
                ))}
              </div>
              {featured.length < recommended.length && limit < 100 && (
                <Form
                  action="/#recommendations"
                  className="market-load-more"
                >
                  <input
                    type="hidden"
                    name="limit"
                    value={Math.min(limit + 10, 100)}
                  />
                  <button type="submit">
                    Дахин үзүүлэх
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                  <span>
                    {featured.length} / {recommended.length} бараа
                  </span>
                </Form>
              )}
            </>
          ) : (
            <div className="shop-empty">
              <Box size={28} aria-hidden="true" />
              <h3>Шинэ сонголтууд удахгүй нэмэгдэнэ</h3>
              <p>Дэлгүүрүүд болон ангиллуудтай танилцаарай.</p>
              <Link href="/catalog" className="market-cta">
                Каталог үзэх
              </Link>
            </div>
          )}
        </section>
        <FeaturedMerchants stores={stores} products={catalog} />
      </div>
    </div>
  );
}
