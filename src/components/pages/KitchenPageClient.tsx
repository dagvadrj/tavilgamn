import type { PageData } from "@/lib/pageData";
import { PlannerLink as Link } from "@/components/PlannerLink";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Clock3,
  CookingPot,
  MapPin,
  Ruler,
  ShieldCheck,
  Store,
  Wrench,
} from "lucide-react";
import { UseKitchenDesignButton } from "@/components/UseKitchenDesignButton";
import { KitchenQuoteRequest } from "@/components/KitchenQuoteRequest";
import { KitchenDesignGallery } from "@/components/KitchenDesignGallery";
import { kitchenGalleryMedia } from "@/lib/kitchenDesignMedia";
import { kitchenPriceLabel } from "@/lib/kitchenMarketplace";
import "@/components/kitchen-design-detail.css";

const styleLabels: Record<string, string> = {
  modern: "Модерн",
  classic: "Классик",
  minimal: "Минимал",
  industrial: "Индастриал",
  scandinavian: "Скандинав",
};
const layoutLabels: Record<string, string> = {
  straight: "Шулуун",
  "l-left": "L хэлбэр · зүүн",
  "l-right": "L хэлбэр · баруун",
  u: "U хэлбэр",
  island: "Аралтай",
};

export function KitchenContent({ design }: PageData["kitchen"]) {
  const preferred = kitchenGalleryMedia(design.media)[0];
  const style = styleLabels[design.style] || design.style;
  const layout = layoutLabels[design.layout] || design.layout;

  return (
    <div className="shop-container kd-page">
      <title>{`${design.title} — tavilga.mn`}</title>
      <meta
        name="description"
        content={
          design.shortDescription ||
          design.description ||
          `${design.storeName}-ийн гал тогооны загвар`
        }
      />
      {design.thumbnailUrl && (
        <meta property="og:image" content={design.thumbnailUrl} />
      )}
      <nav className="kd-breadcrumb" aria-label="Хуудасны зам">
        <Link href="/kitchens">
          <ArrowLeft size={15} />
          Бүх загвар
        </Link>
        <span>/</span>
        <span>Гал тогоо</span>
      </nav>
      <div className="kd-hero">
        <KitchenDesignGallery
          key={`${design.versionId}:${preferred?.id}`}
          media={design.media}
          title={design.title}
        />
        <aside className="kd-summary">
          <div className="kd-eyebrow">ГАЛ ТОГООНЫ ЗАГВАР</div>
          <h1>{design.title}</h1>
          <Link
            className="kd-store-link"
            href={`/catalog/stores/${design.storeId}`}
          >
            <Store size={15} />
            {design.storeName}
            <ArrowUpRight size={14} />
          </Link>
          <div className="kd-style-tags">
            {style && <span>{style}</span>}
            {layout && <span>{layout}</span>}
          </div>
          <div className="kd-price">
            <span>
              {design.pricingMode === "quote"
                ? "Үнийн санал"
                : design.pricingMode === "fixed"
                  ? "Үнэ"
                  : "Эхлэх үнэ"}
            </span>
            <strong>{kitchenPriceLabel(design)}</strong>
            <p>
              {design.pricingMode === "fixed"
                ? "Өөрчлөлт оруулбал үнийг дахин тохиролцоно."
                : "Хэмжээ, материалын сонголтоос хамаарна."}
            </p>
          </div>
          <dl className="kd-facts">
            <div>
              <dt>
                <Ruler size={17} />
                Тохирох өрөө
              </dt>
              <dd>
                {design.roomWidthMm} × {design.roomDepthMm} мм
              </dd>
            </div>
            <div>
              <dt>
                <CookingPot size={17} />
                Бүрдэл
              </dt>
              <dd>{design.cabinetCount} модуль</dd>
            </div>
            <div>
              <dt>
                <Clock3 size={17} />
                Үйлдвэрлэх хугацаа
              </dt>
              <dd>
                {design.leadTimeDays
                  ? `${design.leadTimeDays} хоног`
                  : "Тохиролцоно"}
              </dd>
            </div>
            <div>
              <dt>
                <ShieldCheck size={17} />
                Баталгаа
              </dt>
              <dd>
                {design.warrantyMonths
                  ? `${design.warrantyMonths} сар`
                  : "Тохиролцоно"}
              </dd>
            </div>
          </dl>
          <div className="kd-actions">
            <UseKitchenDesignButton
              designId={design.id}
              returnPath={`/kitchens/${design.slug}`}
            />
            <KitchenQuoteRequest
              designId={design.id}
              returnPath={`/kitchens/${design.slug}`}
              defaultRoom={{
                widthMm: design.roomWidthMm,
                depthMm: design.roomDepthMm,
                heightMm: Math.max(design.maxHeightMm, 2700),
              }}
            />
          </div>
          <p className="kd-action-hint">
            Өрөөний хэмжээ, өнгө, материалыг өөрчлөн төлөвлөөрэй.
          </p>
          <div className="kd-service-lines">
            <p>
              <Wrench size={15} />
              {design.installationIncluded
                ? "Угсралт үнэд багтсан"
                : "Угсралтын үнийг тусад нь тохирно"}
            </p>
            {design.serviceAreas.length > 0 && (
              <p>
                <MapPin size={15} />
                {design.serviceAreas.join(", ")}
              </p>
            )}
          </div>
        </aside>
      </div>
      <section className="kd-details" aria-label="Загварын дэлгэрэнгүй">
        <div className="kd-description">
          <h2>Загварын тухай</h2>
          <p>
            {design.description ||
              design.shortDescription ||
              "Өөрийн өрөөний хэмжээнд тохируулан төлөвлөж, үйлдвэрлэгчээс үнийн санал аваарай."}
          </p>
          <dl className="kd-specifications">
            <div>
              <dt>Материал</dt>
              <dd>
                {design.materials.join(", ") || "Үйлдвэрлэгчтэй тохиролцоно"}
              </dd>
            </div>
            <div>
              <dt>Хэв маяг</dt>
              <dd>{style || "Тохиролцоно"}</dd>
            </div>
            <div>
              <dt>Төлөвлөлт</dt>
              <dd>{layout || "Тохиролцоно"}</dd>
            </div>
            <div>
              <dt>Өрөөний хэмжээ</dt>
              <dd>
                {design.roomWidthMm} × {design.roomDepthMm} мм
              </dd>
            </div>
          </dl>
          {design.tags.length > 0 && (
            <div className="kd-tags">
              {design.tags.map((tag) => (
                <span key={tag}>#{tag}</span>
              ))}
            </div>
          )}
        </div>
        <div className="kd-order-details">
          <h2>Захиалгын мэдээлэл</h2>
          {design.inclusions.length > 0 && (
            <details open>
              <summary>Үнэд багтсан</summary>
              <ul>
                {design.inclusions.map((item) => (
                  <li key={item}>
                    <Check size={15} />
                    {item}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {design.exclusions.length > 0 && (
            <details>
              <summary>Үнэд багтаагүй</summary>
              <ul>
                {design.exclusions.map((item) => (
                  <li key={item}>
                    <span>—</span>
                    {item}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <Link
            className="kd-manufacturer"
            href={`/catalog/stores/${design.storeId}`}
          >
            <span className="kd-manufacturer-icon">
              <Store size={21} />
            </span>
            <span>
              <small>Үйлдвэрлэгч</small>
              <strong>{design.storeName}</strong>
              <em>Үйлдвэртэй холбогдох</em>
            </span>
            <ArrowUpRight size={18} />
          </Link>
          <Link className="kd-new-design" href="/kitchen?new=1">
            Өөр загвар төлөвлөх
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </section>
    </div>
  );
}
