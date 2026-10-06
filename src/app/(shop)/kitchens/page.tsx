import Link from "next/link";
import { ArrowUpRight, CookingPot } from "lucide-react";
import { readPublishedKitchenDesigns } from "@/lib/kitchenMarketplaceServer";
import { kitchenPriceLabel } from "@/lib/kitchenMarketplace";
import { DirectoryHeading } from "@/components/DirectoryHeading";
import { DirectoryCard } from "@/components/DirectoryCard";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Гал тогооны загварууд — tavilga.mn",
  description: "Монголын үйлдвэр, гар урчуудын гал тогооны бэлэн загварууд.",
};

export default async function KitchenMarketplacePage() {
  const designs = await readPublishedKitchenDesigns().catch(() => []);
  return (
    <div className="shop-container directory-page">
      <DirectoryHeading title="Гал тогооны загварууд" eyebrow="Таны гэрт тохирох гал тогоо"
        description="Үйлдвэр, гар урчуудын баталгаажуулсан загваруудыг өрөөний хэмжээ, үнэ, хийх хугацаагаар нь харьцуулаарай."
        action={{ href: "/kitchen", label: "Өөрөө төлөвлөх" }}/>
      <nav className="directory-filters" aria-label="Гал тогооны сонголт">
        <Link href="/kitchens" aria-current="page">Бүх загвар · {designs.length}</Link>
        <Link href="/stores">Үйлдвэр, дэлгүүрүүд <ArrowUpRight size={15} aria-hidden="true"/></Link>
      </nav>
      {designs.length ? (
        <div className="directory-grid">
          {designs.map(design => <DirectoryCard key={design.id} href={`/kitchens/${design.slug}`} title={design.title}
            image={design.thumbnailUrl} badge="Гал тогоо" eyebrow={design.storeName}
            description={design.shortDescription || design.description || "Дэлгэрэнгүй мэдээллийг үйлдвэрлэгчээс авна."}
            tags={[`${design.roomWidthMm} × ${design.roomDepthMm} мм`, `${design.cabinetCount} модуль`]}
            summary={{ label: design.pricingMode === "quote" ? "Үнэ" : "Эхлэх үнэ", value: kitchenPriceLabel(design),
              note: design.leadTimeDays ? `${design.leadTimeDays} хоног` : undefined }} action="Загвар үзэх"/>)}
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
