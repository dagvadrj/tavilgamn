import type { PageData } from "@/lib/pageData";
import { PlannerLink as Link } from "@/components/PlannerLink";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Ruler,
  ShieldCheck,
  Store,
  Wrench,
} from "lucide-react";
import { UseKitchenDesignButton } from "@/components/UseKitchenDesignButton";
import { KitchenQuoteRequest } from "@/components/KitchenQuoteRequest";
import { KitchenDesignStage } from "@/components/KitchenDesignStage";
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
        <KitchenDesignStage
          key={`${design.versionId}:${preferred?.id}`}
          media={design.media}
          title={design.title}
          model={design.model}
          poster={design.thumbnailUrl}
        />
        <aside className="kd-summary">
          <Link
            className="kd-store-link"
            href={`/catalog/stores/${design.storeId}`}
          >
            <Store size={15} />
            {design.storeName}
            <ArrowUpRight size={14} />
          </Link>
          <h1>{design.title}</h1>
          {(style || layout) && (
            <p className="kd-meta">{[style, layout].filter(Boolean).join(" · ")}</p>
          )}
          <div className="kd-price">
            <strong>{kitchenPriceLabel(design)}</strong>
            <span>
              {design.pricingMode === "fixed" ? "Тогтсон үнэ" : design.pricingMode === "quote" ? "Үйлдвэр үнийн санал өгнө" : "Эхлэх үнэ"}
              {design.leadTimeDays ? ` · ${design.leadTimeDays} хоногт хийнэ` : ""}
            </span>
          </div>
          <p className="kd-quick">
            <Ruler size={15} />
            {design.model
              ? `${design.model.widthMm} × ${design.model.depthMm} мм`
              : `${design.roomWidthMm} × ${design.roomDepthMm} мм`}
            <span aria-hidden="true">·</span>
            {design.cabinetCount} модуль
          </p>
          {/* One clear route: try it, see it in your room, then order. */}
          <ol className="kd-steps">
            {design.plannerReady && (
              <li>
                <UseKitchenDesignButton
                  designId={design.id}
                  returnPath={`/kitchens/${design.slug}`}
                  footprint={
                    design.model
                      ? { widthMm: design.model.widthMm, depthMm: design.model.depthMm, heightMm: design.model.heightMm }
                      : { widthMm: design.roomWidthMm, depthMm: design.roomDepthMm, heightMm: design.maxHeightMm }
                  }
                />
              </li>
            )}
            {design.plannerReady && (
              <li>
                <UseKitchenDesignButton
                  designId={design.id}
                  returnPath={`/kitchens/${design.slug}`}
                  target="room"
                />
              </li>
            )}
            <li>
              <KitchenQuoteRequest
                designId={design.id}
                returnPath={`/kitchens/${design.slug}`}
                defaultRoom={{
                  widthMm: design.roomWidthMm,
                  depthMm: design.roomDepthMm,
                  heightMm: Math.max(design.maxHeightMm, 2700),
                }}
              />
            </li>
          </ol>
          <p className="kd-service-lines">
            <Wrench size={14} />
            {design.installationIncluded ? "Угсралт багтсан" : "Угсралт тусдаа"}
            {design.warrantyMonths ? <> · <ShieldCheck size={14} /> {design.warrantyMonths} сар баталгаа</> : null}
          </p>
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
            {design.model && (
              <div>
                <dt>Гадна хэмжээ</dt>
                <dd>{design.model.widthMm} × {design.model.depthMm} × {design.model.heightMm} мм</dd>
              </div>
            )}
            <div>
              <dt>Үйлдвэрлэх хугацаа</dt>
              <dd>{design.leadTimeDays ? `${design.leadTimeDays} хоног` : "Тохиролцоно"}</dd>
            </div>
            <div>
              <dt>Баталгаа</dt>
              <dd>{design.warrantyMonths ? `${design.warrantyMonths} сар` : "Тохиролцоно"}</dd>
            </div>
            {design.serviceAreas.length > 0 && (
              <div>
                <dt>Үйлчлэх бүс</dt>
                <dd>{design.serviceAreas.join(", ")}</dd>
              </div>
            )}
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
