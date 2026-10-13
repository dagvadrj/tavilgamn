import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Box, MapPin } from "lucide-react";
import type { Product, Store } from "@/lib/types";
import { hasProductPhoto } from "@/lib/homeMarketplace";
import { STORE_TYPES } from "@/lib/storeTypes";

function StoreExhibitCard({
  store,
  products,
  featured = false,
  index = 0,
}: {
  store: Store;
  products: Product[];
  featured?: boolean;
  index?: number;
}) {
  const furniture = products.filter(
    (product) =>
      product.storeIds?.includes(store.id) && hasProductPhoto(product),
  );
  const cover = furniture[0]?.image || store.image;
  const location = [store.city, store.district !== "-" && store.district]
    .filter(Boolean)
    .join(" · ");
  const type =
    STORE_TYPES.find((item) => item.id === store.storeType)?.label ?? "Дэлгүүр";
  return (
    <Link
      href={`/catalog/stores/${store.id}`}
      className={`store-exhibit-card${featured ? ` store-exhibit-feature store-exhibit-feature--${index}` : ""}`}
    >
      {cover ? (
        <Image
          src={cover}
          alt={`${store.name} — тавилгын үзүүлэн`}
          fill
          quality={90}
          sizes={
            featured
              ? "(max-width: 699px) 100vw, (max-width: 1099px) 50vw, 60vw"
              : "(max-width: 539px) 100vw, (max-width: 999px) 50vw, 33vw"
          }
        />
      ) : (
        <span className="store-exhibit-placeholder">
          Үзүүлэнгийн зураг удахгүй
        </span>
      )}
      <span className="store-exhibit-shade" aria-hidden="true" />
      <span className="store-exhibit-type">{type}</span>
      <span className="store-exhibit-number" aria-hidden="true">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="store-exhibit-glass">
        <div className="store-exhibit-identity">
          {store.image && (
            <span className="store-exhibit-logo">
              <Image
                src={store.image}
                alt=""
                width={40}
                height={40}
                unoptimized
              />
            </span>
          )}
          <div>
            <span className="store-exhibit-eyebrow">
              {featured ? "ОНЦЛОХ ДЭЛГҮҮР" : type}
            </span>
            <h3>{store.name}</h3>
          </div>
        </div>
        {store.description && (
          <p className="store-exhibit-description">{store.description}</p>
        )}
        <div className="store-exhibit-footer">
          <span>
            {location && (
              <>
                <MapPin size={12} aria-hidden="true" />
                {location}
              </>
            )}
          </span>
          <span className="store-exhibit-open">
            Дэлгүүр үзэх{" "}
            <span>
              <ArrowUpRight size={18} aria-hidden="true" />
            </span>
          </span>
        </div>
      </div>
    </Link>
  );
}

export function StoreExhibitionGrid({
  stores,
  products,
}: {
  stores: Store[];
  products: Product[];
}) {
  const featured = stores.slice(0, 4);
  return featured.length > 0 ? (
    <section
      className={`store-exhibition-bento store-exhibition-bento--${featured.length}`}
      aria-label="Онцлох дэлгүүрүүдийн үзүүлэн"
    >
      {featured.map((store, index) => (
        <StoreExhibitCard
          key={store.id}
          store={store}
          products={products}
          featured
          index={index}
        />
      ))}
    </section>
  ) : (
    <div className="store-exhibition-empty">
      <h2>Шинэ үзүүлэнгүүд удахгүй</h2>
      <p>Дэлгүүрүүдийн шинэ бүтээлүүд энд байрлана.</p>
      <Link href="/catalog">
        Тавилгын каталог үзэх <ArrowUpRight size={16} />
      </Link>
    </div>
  );
}

export function StoreExhibition({
  stores,
  products,
}: {
  stores: Store[];
  products: Product[];
}) {
  return (
    <div className="store-exhibition shop-container">
      <header className="store-exhibition-intro">
        <div>
          <span className="exhibition-eyebrow">
            TAVILGA / ДЭЛГҮҮРҮҮДИЙН ҮЗЭСГЭЛЭН
          </span>
          <h1>
            Сайхан гэр.
            <br />
            <span>Сайн бүтээлээс.</span>
          </h1>
        </div>
        <div className="store-exhibition-intro-copy">
          <p>
            Өөрийн хэв маягтай дэлгүүрүүд.
            <br />
            Таны орон зайд тохирох шинэ санаанууд.
          </p>
          <Link href="/stores">
            Бүх дэлгүүртэй танилцах{" "}
            <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </header>
      <StoreExhibitionGrid stores={stores} products={products} />
      <section className="exhibition-invitation" aria-label="Өрөөгөө төсөөлөх">
        <div>
          <span className="exhibition-eyebrow">
            ХАРААД ТӨСӨӨЛ. БАЙРЛУУЛААД МЭДЭР.
          </span>
          <h2>Таны гэрт ямар харагдах бол?</h2>
          <p>Таалагдсан тавилгаа өрөөндөө 3D-ээр байрлуулж үзээрэй.</p>
        </div>
        <Link href="/planner">
          <Box size={18} aria-hidden="true" />
          Өрөөгөө төлөвлөх <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
      </section>
      {stores.length > 0 && (
        <section
          className="store-exhibition-directory"
          aria-labelledby="exhibition-directory-title"
        >
          <div className="exhibition-directory-heading">
            <div>
              <span className="exhibition-eyebrow">
                ӨӨРИЙН ХЭВ МАЯГИЙГ ОЛООРОЙ
              </span>
              <h2 id="exhibition-directory-title">
                Дэлгүүр бүр өөрийн ертөнцтэй.
              </h2>
            </div>
            <Link href="/stores">
              {stores.length} дэлгүүр{" "}
              <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
          <div className="store-exhibition-grid">
            {stores.map((store, index) => (
              <StoreExhibitCard
                key={store.id}
                store={store}
                products={products}
                index={index}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
