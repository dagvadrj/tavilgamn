import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Clock3,
  CookingPot,
  MapPin,
  Ruler,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { readPublishedKitchenDesignBySlug } from "@/lib/kitchenMarketplaceServer";
import { UseKitchenDesignButton } from "@/components/UseKitchenDesignButton";
import { KitchenQuoteRequest } from "@/components/KitchenQuoteRequest";

export const dynamic = "force-dynamic";

type PageProps = { params: { slug: string } };
const getDesign = cache((slug: string) =>
  readPublishedKitchenDesignBySlug(slug).catch(() => null),
);

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const design = await getDesign(params.slug);
  if (!design) return { title: "Гал тогооны загвар олдсонгүй — tavilga.mn" };
  return {
    title: `${design.title} — tavilga.mn`,
    description:
      design.shortDescription ||
      design.description ||
      `${design.storeName}-ийн гал тогооны загвар`,
    openGraph: design.thumbnailUrl
      ? { images: [design.thumbnailUrl] }
      : undefined,
  };
}

function mediaLabel(kind: string, source: string) {
  if (kind === "ai_render" || source === "ai") return "AI бодит дүрслэл";
  if (kind === "photo") return "Бодит зураг";
  if (kind === "plan") return "Төлөвлөлтийн зураг";
  if (kind === "thumbnail") return "Үндсэн зураг";
  return "Render зураг";
}

export default async function KitchenDesignPage({ params }: PageProps) {
  const design = await getDesign(params.slug);
  if (!design) notFound();
  const primary =
    design.media.find((item) => item.isPrimary) ?? design.media[0];
  const gallery = design.media.filter((item) => item.id !== primary?.id);

  return (
    <main className="shop-container py-8 md:py-12">
      <Link
        href="/kitchens"
        className="mb-6 inline-flex items-center gap-2 text-sm text-black/55 hover:text-[#293c32]"
      >
        <ArrowLeft size={16} />
        Бүх загвар
      </Link>
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.75fr)]">
        <section className="space-y-4">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] bg-[#f1efe9]">
            {primary ? (
              <>
                <Image
                  src={primary.url}
                  alt={primary.altText || design.title}
                  fill
                  priority
                  sizes="(max-width: 1280px) 100vw, 66vw"
                  className="object-cover"
                />
                <span className="absolute bottom-4 left-4 rounded-full bg-black/70 px-3 py-1.5 text-xs text-white">
                  {mediaLabel(primary.kind, primary.source)}
                </span>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-[#293c32]/30">
                <CookingPot size={64} />
              </div>
            )}
          </div>
          {gallery.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {gallery.map((item) => (
                <figure
                  key={item.id}
                  className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-[#f1efe9]"
                >
                  <Image
                    src={item.url}
                    alt={item.altText || design.title}
                    fill
                    sizes="(max-width: 640px) 50vw, 25vw"
                    className="object-cover"
                  />
                  <figcaption className="absolute inset-x-2 bottom-2 w-fit rounded-full bg-black/70 px-2.5 py-1 text-[11px] text-white">
                    {mediaLabel(item.kind, item.source)}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </section>

        <aside className="h-fit space-y-6 rounded-[2rem] border border-black/10 bg-white p-6 shadow-sm md:p-8 xl:sticky xl:top-24">
          <div>
            <p className="text-xs uppercase tracking-[.18em] text-[#69756c]">
              {design.storeName}
            </p>
            <h1 className="mt-2 font-display text-3xl text-[#1d2b24] md:text-4xl">
              {design.title}
            </h1>
            <p className="mt-3 text-sm leading-6 text-black/60">
              {design.description ||
                design.shortDescription ||
                "Дэлгэрэнгүй мэдээллийг үйлдвэрлэгчээс авна."}
            </p>
          </div>
          <div className="rounded-2xl bg-[#f3f4ef] p-4">
            <span className="text-xs text-black/45">
              {design.pricingMode === "quote" ? "Үнэ" : "Эхлэх үнэ"}
            </span>
            <strong className="mt-1 block text-2xl text-[#293c32]">
              {design.priceFrom == null
                ? "Үнийн санал авна"
                : `${design.priceFrom.toLocaleString()} ₮`}
            </strong>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-black/10 p-3">
              <dt className="flex items-center gap-2 text-xs text-black/45">
                <Ruler size={14} />
                Тохирох өрөө
              </dt>
              <dd className="mt-1 font-medium">
                {design.roomWidthMm}×{design.roomDepthMm} мм
              </dd>
            </div>
            <div className="rounded-xl border border-black/10 p-3">
              <dt className="flex items-center gap-2 text-xs text-black/45">
                <CookingPot size={14} />
                Бүрдэл
              </dt>
              <dd className="mt-1 font-medium">{design.cabinetCount} модуль</dd>
            </div>
            <div className="rounded-xl border border-black/10 p-3">
              <dt className="flex items-center gap-2 text-xs text-black/45">
                <Clock3 size={14} />
                Хугацаа
              </dt>
              <dd className="mt-1 font-medium">
                {design.leadTimeDays
                  ? `${design.leadTimeDays} хоног`
                  : "Тохиролцоно"}
              </dd>
            </div>
            <div className="rounded-xl border border-black/10 p-3">
              <dt className="flex items-center gap-2 text-xs text-black/45">
                <ShieldCheck size={14} />
                Баталгаа
              </dt>
              <dd className="mt-1 font-medium">
                {design.warrantyMonths
                  ? `${design.warrantyMonths} сар`
                  : "Тохиролцоно"}
              </dd>
            </div>
          </dl>
          <div className="space-y-2 text-sm">
            <p className="flex items-center gap-2">
              <Wrench size={16} className="text-[#42634f]" />
              {design.installationIncluded
                ? "Угсралт үнэд багтсан"
                : "Угсралтын үнийг тусад нь тохирно"}
            </p>
            {design.serviceAreas.length > 0 && (
              <p className="flex items-start gap-2">
                <MapPin size={16} className="mt-0.5 shrink-0 text-[#42634f]" />
                {design.serviceAreas.join(", ")}
              </p>
            )}
          </div>
          <div className="grid gap-2">
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
            <Link
              href={`/catalog/stores/${design.storeId}`}
              className="inline-flex min-h-11 items-center justify-center gap-2 text-sm font-medium text-[#293c32]/70 hover:text-[#293c32]"
            >
              Үйлдвэртэй холбогдох <ArrowUpRight size={16} />
            </Link>
            <Link
              href="/kitchen?new=1"
              className="inline-flex min-h-11 items-center justify-center text-sm font-medium text-[#293c32]/70 hover:text-[#293c32]"
            >
              Шинээр төлөвлөх
            </Link>
          </div>
        </aside>
      </div>

      {(design.inclusions.length > 0 ||
        design.exclusions.length > 0 ||
        design.tags.length > 0) && (
        <section className="mt-10 grid gap-5 md:grid-cols-2">
          {design.inclusions.length > 0 && (
            <div className="rounded-3xl border border-black/10 bg-white p-6">
              <h2 className="text-lg font-semibold">Үнэд багтсан</h2>
              <ul className="mt-4 space-y-2 text-sm text-black/65">
                {design.inclusions.map((item) => (
                  <li key={item} className="flex gap-2">
                    <Check
                      size={16}
                      className="mt-0.5 shrink-0 text-[#42634f]"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {design.exclusions.length > 0 && (
            <div className="rounded-3xl border border-black/10 bg-white p-6">
              <h2 className="text-lg font-semibold">Үнэд багтаагүй</h2>
              <ul className="mt-4 space-y-2 text-sm text-black/65">
                {design.exclusions.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-black/35">—</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {design.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 md:col-span-2">
              {design.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-[#293c32]/[.06] px-3 py-1.5 text-xs text-[#293c32]"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
