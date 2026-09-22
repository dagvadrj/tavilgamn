import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, CookingPot, Ruler } from "lucide-react";
import { readPublishedKitchenDesigns } from "@/lib/kitchenMarketplaceServer";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Гал тогооны загварууд — tavilga.mn",
  description: "Монголын үйлдвэр, гар урчуудын гал тогооны бэлэн загварууд.",
};

export default async function KitchenMarketplacePage() {
  const designs = await readPublishedKitchenDesigns().catch(() => []);
  return (
    <div className="shop-container py-10 md:py-16">
      <header className="mb-8 grid gap-5 rounded-[2rem] bg-[#293c32] p-7 text-white md:grid-cols-[1fr_auto] md:items-end md:p-10">
        <div>
          <span className="text-xs uppercase tracking-[0.2em] text-white/60">
            Kitchen marketplace
          </span>
          <h1 className="mt-3 font-display text-4xl md:text-5xl">
            Бодитоор хийх гал тогооны загварууд
          </h1>
          <p className="mt-3 max-w-2xl text-white/70">
            Үйлдвэр болон гар урчуудын хянан баталгаажуулсан загварыг өрөөний
            хэмжээ, үнэ, хугацаатай нь харьцуулна.
          </p>
        </div>
        <Link
          href="/kitchen"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-medium text-[#293c32]"
        >
          Өөрөө төлөвлөх <ArrowUpRight size={16} />
        </Link>
      </header>
      {designs.length ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {designs.map((design) => (
            <article
              key={design.id}
              className="overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm"
            >
              <div className="relative aspect-[4/3] bg-[#f1efe9]">
                {design.thumbnailUrl ? (
                  <Image
                    src={design.thumbnailUrl}
                    alt={design.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[#293c32]/30">
                    <CookingPot size={48} />
                  </div>
                )}
              </div>
              <div className="space-y-3 p-5">
                <div>
                  <p className="text-xs uppercase tracking-wider text-[#69756c]">
                    {design.storeName}
                  </p>
                  <h2 className="mt-1 text-xl font-semibold">{design.title}</h2>
                </div>
                <p className="line-clamp-2 text-sm text-black/60">
                  {design.shortDescription ||
                    design.description ||
                    "Дэлгэрэнгүй мэдээллийг үйлдвэрлэгчээс авна."}
                </p>
                <div className="flex flex-wrap gap-2 text-xs text-black/60">
                  <span className="inline-flex items-center gap-1 rounded-full bg-black/5 px-3 py-1.5">
                    <Ruler size={13} />
                    {design.roomWidthMm}×{design.roomDepthMm} мм
                  </span>
                  <span className="rounded-full bg-black/5 px-3 py-1.5">
                    {design.cabinetCount} модуль
                  </span>
                </div>
                <div className="flex items-end justify-between gap-3 border-t border-black/10 pt-4">
                  <div>
                    <span className="block text-xs text-black/45">
                      {design.pricingMode === "quote" ? "Үнэ" : "Эхлэх үнэ"}
                    </span>
                    <strong>
                      {design.priceFrom == null
                        ? "Үнийн санал"
                        : `${design.priceFrom.toLocaleString()} ₮`}
                    </strong>
                  </div>
                  {design.leadTimeDays && (
                    <span className="text-xs text-black/50">
                      {design.leadTimeDays} хоног
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-black/15 px-6 py-16 text-center">
          <CookingPot className="mx-auto text-[#69756c]" size={42} />
          <h2 className="mt-4 text-xl font-semibold">
            Нийтлэгдсэн загвар хараахан алга
          </h2>
          <p className="mt-2 text-sm text-black/55">
            Үйлдвэрүүдийн эхний загварууд admin хяналтаар орж байна.
          </p>
        </div>
      )}
    </div>
  );
}
