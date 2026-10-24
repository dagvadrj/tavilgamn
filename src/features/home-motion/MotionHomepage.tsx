"use client";

import {
  m as motion,
  MotionConfig,
  LazyMotion,
  domAnimation,
} from "framer-motion";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Armchair,
  Check,
  Grid2X2,
  Layers,
  Ruler,
  Store,
} from "lucide-react";
import { PlannerLink as Link } from "@/components/PlannerLink";
import { CATEGORIES } from "@/lib/products";
import { HomeRecommendations } from "@/components/HomeRecommendations";
import { hasAvailableStock } from "@/lib/inventory";
import { hasProductPhoto } from "@/lib/homeMarketplace";
import { DEFAULT_HOMEPAGE_HERO } from "@/lib/homepagePresentation";
import type { PageData } from "@/lib/pageData";
import { HeroDemo } from "./HeroDemo";
import { HomepageTour } from "./HomepageTour";
import { HomeCount, HomeStatistics } from "./HomeStatistics";
import { ProductPhoto } from "./ProductPhoto";
import { useMotionActivity } from "@/features/motion/useMotionActivity";
import { ModelDemo } from "@/features/motion/ModelDemo";
import "./home-motion.css";
import "./home-shopping.css";

const reveal = { hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0 } };

export function MotionHomepage({
  catalog,
  stores,
  homepageHero,
  homepageProductIds,
  homepageMaterialSwatches = [],
  homepageStatistics: stats,
  loading,
  error,
  onRetry,
}: PageData["home"] & {
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  const hero = homepageHero ?? DEFAULT_HOMEPAGE_HERO;
  const product =
    homepageProductIds
      ?.map((id) => catalog.find((item) => item.id === id && item.model))
      .find(Boolean) ??
    catalog.find((item) => item.category === "sofa" && item.model) ??
    catalog.find((item) => item.model);
  const bento = useMotionActivity<HTMLElement>();
  const available = catalog.filter(hasAvailableStock).filter(hasProductPhoto);
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation}>
        <div className="home-motion">
          <section
            className="home-hero-layout home-motion-wrap"
            aria-labelledby="home-motion-title"
          >
            <div className="home-hero-copy">
              <motion.p
                className="home-eyebrow"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6 }}
              >
                <span /> ТӨСӨӨЛЛӨӨС БОДИТ СОНГОЛТ РУУ
              </motion.p>
              <motion.h1
                id="home-motion-title"
                data-homepage-field="title"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.75 }}
              >
                {hero.title}
              </motion.h1>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18, duration: 0.6 }}
              >
                <p className="home-hero-description" data-homepage-field="description">{hero.description}</p>
                <div className="home-hero-actions">
                  <Link href={hero.primaryHref} className="home-button" data-homepage-field="primaryLabel">
                    {hero.primaryLabel}
                    <ArrowUpRight size={18} />
                  </Link>
                  <Link
                    href={hero.secondaryHref}
                    className="home-button home-button-secondary"
                    data-homepage-field="secondaryLabel"
                  >
                    {hero.secondaryLabel}
                    <ArrowRight size={18} />
                  </Link>
                </div>
                <p className="home-hero-note">
                  <Check size={14} /> Өөрийн хурдаар төлөвлө. Боломжуудаа
                  харьцуул.
                </p>
              </motion.div>
              <a className="home-discover" href="#how-it-works">
                Хэрхэн ажиллахыг үзэх <ArrowDown size={15} />
              </a>
            </div>
            <HeroDemo product={product} image={hero.image} loading={loading} />
          </section>
          {error && (
            <div className="home-data-notice home-motion-wrap" role="alert">
              Каталог, үзүүлэлтүүдийг ачаалж чадсангүй.{" "}
              <button type="button" onClick={onRetry}>
                Дахин оролдох
              </button>
            </div>
          )}
          <HomeStatistics stats={stats} loading={loading} />
          <section
            className="home-shopping home-motion-wrap"
            aria-labelledby="home-shopping-title"
          >
            <div className="home-section-heading">
              <div>
                <h2 id="home-shopping-title">Тавилгын сонголтууд</h2>
                <p>Хэмжээ, үнэ, өнгөө нэг дор харьцуулаарай.</p>
              </div>
              <Link href="/catalog">
                Бүгдийг үзэх <ArrowUpRight size={17} />
              </Link>
            </div>
            <nav
              className="home-shopping-categories"
              aria-label="Тавилгаа ангиллаар сонгох"
            >
              {CATEGORIES.slice(0, 6).map((category) => (
                <Link key={category.id} href={`/catalog/${category.id}`}>
                  {category.name}
                  <span>
                    {loading
                      ? "—"
                      : catalog.filter(
                          (item) =>
                            item.category === category.id &&
                            hasAvailableStock(item),
                        ).length}
                  </span>
                </Link>
              ))}
            </nav>
            {available.length > 0 ? (
              <HomeRecommendations
                products={available}
                initialCount={8}
                offerCheckedAt={Date.now()}
              />
            ) : (
              <p className="home-shopping-status" role="status">
                {loading
                  ? "Тавилгуудыг ачаалж байна…"
                  : error
                    ? "Тавилгуудыг ачаалж чадсангүй. Дээрх дахин оролдох товчийг ашиглана уу."
                    : "Шинэ тавилгууд удахгүй нэмэгдэнэ."}
              </p>
            )}
          </section>
          <section
            ref={bento.ref}
            className="home-bento-section home-motion-wrap"
            aria-labelledby="home-bento-title"
          >
            <div className="home-section-heading">
              <div>
                <p className="home-eyebrow">ТАНЫ ГЭР. ТАНЫ ШИЙДЭЛ.</p>
                <h2 id="home-bento-title">
                  Нэг санаанаас.
                  <br />
                  Бодит боломжууд руу.
                </h2>
              </div>
              <p>Тавилга хайхаас үйлдвэрлэлийн санал авах хүртэл.</p>
            </div>
            <motion.div
              className="home-bento"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.1 }}
              transition={{ staggerChildren: 0.09 }}
            >
              <motion.article
                variants={reveal}
                transition={{ duration: 0.6 }}
                className="home-bento-kitchen"
                data-paused={!bento.active}
              >
                <div className="home-tile-heading">
                  <span className="home-tile-icon">
                    <Grid2X2 size={20} />
                  </span>
                  <span>01 / ГАЛ ТОГОО</span>
                </div>
                <h3>
                  Таны хэмжээ.
                  <br />
                  Таны гал тогоо.
                </h3>
                <p>
                  Шүүгээ, тавцан, тоноглолоо сонгож, хэмжээндээ тааруулан
                  төлөвлөөрэй.
                </p>
                <div className="home-module-demo home-module-real">
                  <ModelDemo
                    kind="kitchen"
                    scene="place"
                    paused={!bento.active}
                  />
                </div>
                <Link href="/kitchen">
                  Гал тогоо төлөвлөх <ArrowUpRight size={17} />
                </Link>
              </motion.article>
              <motion.article
                variants={reveal}
                transition={{ duration: 0.6 }}
                className="home-bento-materials"
                data-paused={!bento.active}
              >
                <div className="home-tile-heading">
                  <Layers size={20} />
                  <span>02 / МАТЕРИАЛ</span>
                </div>
                <h3>
                  Хараад. Мэдрээд.
                  <br />
                  Өөртөө тааруул.
                </h3>
                <div className="home-material-fan" aria-hidden="true">
                  {homepageMaterialSwatches.map((item) => (
                    <span
                      key={item.id}
                      title={item.name}
                      style={{ backgroundColor: item.color }}
                    />
                  ))}
                </div>
                <p>
                  {stats?.materials != null ? (
                    <>
                      <HomeCount value={stats.materials} /> идэвхтэй материалын
                      сонголт
                    </>
                  ) : loading ? (
                    "Материалын санг ачаалж байна…"
                  ) : (
                    "Материалын сангаа төлөвлөгчөөс үзээрэй."
                  )}
                </p>
                <Link href="/kitchen">
                  Материалаа сонгох <ArrowUpRight size={17} />
                </Link>
              </motion.article>
              <motion.article
                variants={reveal}
                transition={{ duration: 0.6 }}
                className="home-bento-catalog"
              >
                <div className="home-tile-heading">
                  <Armchair size={20} />
                  <span>03 / ТАВИЛГА</span>
                </div>
                <div className="home-catalog-stack" aria-hidden="true">
                  {catalog.slice(0, 3).map((item) => (
                    <div key={item.id}>
                      <ProductPhoto src={item.image} alt="" />
                    </div>
                  ))}
                  {!catalog.length && <Armchair size={60} strokeWidth={1} />}
                </div>
                <h3>
                  Сонголт бүрийн цаана
                  <br />
                  таны орон зай.
                </h3>
                <p>
                  {stats ? (
                    <>
                      <HomeCount value={stats.products} /> тавилга. Хэмжээ,
                      материал, үнийг нэг дор харьцуул.
                    </>
                  ) : (
                    "Тавилгын сонголтоо каталогоос олоорой."
                  )}
                </p>
                <Link href="/catalog">
                  Каталог үзэх <ArrowUpRight size={17} />
                </Link>
              </motion.article>
              <motion.article
                variants={reveal}
                transition={{ duration: 0.6 }}
                className="home-bento-categories"
              >
                <div className="home-tile-heading">
                  <Ruler size={20} />
                  <span>04 / СОНГОЛТЫН БҮТЭЦ</span>
                </div>
                <h3>Гэрийн хэсэг бүрд.</h3>
                <p>Каталогт байгаа тавилгын тоо, ангиллаар.</p>
                <div
                  className="home-category-chart"
                  aria-label="Каталогийн ангиллын бүтэц"
                >
                  {stats?.categories.slice(0, 5).map((item) => (
                    <Link
                      key={item.id}
                      href={`/catalog/${encodeURIComponent(item.id)}`}
                    >
                      <span>
                        {CATEGORIES.find((category) => category.id === item.id)
                          ?.name ?? item.id}
                      </span>
                      <span className="home-category-track">
                        <motion.i
                          initial={{ scaleX: 0 }}
                          whileInView={{
                            scaleX:
                              item.count /
                              Math.max(1, stats.categories[0].count),
                          }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.65 }}
                        />
                      </span>
                      <b>{item.count}</b>
                    </Link>
                  ))}
                  {!stats?.categories.length && (
                    <p>
                      {loading
                        ? "Ангиллуудыг ачаалж байна…"
                        : stats
                          ? "Каталогийн шинэ сонголтууд удахгүй нэмэгдэнэ."
                          : "Ангиллын мэдээлэл түр боломжгүй."}
                    </p>
                  )}
                </div>
                <Link href="/catalog">
                  Бүх ангилал <ArrowUpRight size={17} />
                </Link>
              </motion.article>
            </motion.div>
          </section>
          <HomepageTour />
          <section
            className="home-stores home-motion-wrap"
            aria-labelledby="home-stores-title"
          >
            <div className="home-section-heading">
              <div>
                <p className="home-eyebrow">ҮЙЛДВЭР. ДЭЛГҮҮР. ТАНЫ СОНГОЛТ.</p>
                <h2 id="home-stores-title">
                  Сайн тавилгыг
                  <br />
                  сайхан гэртэй холбоё.
                </h2>
              </div>
              <Link href="/stores">
                Бүх дэлгүүр <ArrowUpRight size={17} />
              </Link>
            </div>
            {stores.length > 0 ? (
              <div className="home-store-list">
                {stores.slice(0, 4).map((store) => (
                  <Link
                    key={store.id}
                    href={`/catalog/stores/${encodeURIComponent(store.id)}`}
                  >
                    <span className="home-store-monogram">
                      {store.name.slice(0, 2)}
                    </span>
                    <div>
                      <h3>{store.name}</h3>
                      <p>
                        {store.city}
                        {store.district && store.district !== "-"
                          ? ` · ${store.district}`
                          : ""}
                      </p>
                    </div>
                    <ArrowUpRight size={17} />
                  </Link>
                ))}
              </div>
            ) : (
              <p>
                {loading
                  ? "Дэлгүүрүүдийг ачаалж байна…"
                  : error
                    ? "Дэлгүүрийн мэдээлэл түр боломжгүй."
                    : "Шинэ дэлгүүрүүдтэй удахгүй танилцаарай."}
              </p>
            )}
            <div className="home-merchant-invite">
              <div>
                <Store size={22} />
                <h3>Та тавилга үйлдвэрлэдэг, борлуулдаг уу?</h3>
                <p>
                  Бүтээгдэхүүнээ танилцуулж, шинэ хэрэглэгчидтэй холбогдоорой.
                </p>
              </div>
              <Link href="/?topic=merchant#contact" className="home-button">
                Дэлгүүрээ нээх <ArrowRight size={17} />
              </Link>
            </div>
          </section>
        </div>
      </LazyMotion>
    </MotionConfig>
  );
}
