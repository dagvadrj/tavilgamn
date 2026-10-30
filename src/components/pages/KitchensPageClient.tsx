import type { PageData } from "@/lib/pageData";
import { PlannerLink as Link } from "@/components/PlannerLink";
import { CookingPot } from "lucide-react";
import { kitchenPriceLabel } from "@/lib/kitchenMarketplace";
import { DirectoryHeading } from "@/components/DirectoryHeading";
import { DirectoryCard } from "@/components/DirectoryCard";
import Form from "next/form";
import { Search, X } from "lucide-react";
import { kitchenDesignMatchesSearch } from "@/lib/kitchenListingSuggestions";

export function KitchensContent({
  allDesigns,
  query,
}: {
  allDesigns: PageData["kitchens"]["designs"];
  query: string;
}) {
  const designs = allDesigns.filter((design) =>
    kitchenDesignMatchesSearch(design, query),
  );
  // Only tags shared by several designs help people browse; one-off tags are noise.
  const tagCounts = new Map<string, number>();
  for (const tag of allDesigns.flatMap((design) => design.tags))
    tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  const tags = [...tagCounts]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([tag]) => tag);
  return (
    <div className="shop-container directory-page">
      <DirectoryHeading
        title="Гал тогооны загварууд"
        eyebrow="Таны гэрт тохирох гал тогоо"
        description="Бэлэн загвараа сонгоод 3D-ээр туршиж, өрөөндөө байрлуулж үзээд захиалаарай."
        action={{ href: "/kitchen", label: "Өөрөө төлөвлөх" }}
      />
      <Form
        action="/kitchens"
        className="kitchen-directory-search"
        role="search"
      >
        <Search size={17} />
        <input
          type="search"
          name="q"
          aria-label="Гал тогооны загвар хайх"
          defaultValue={query}
          key={query}
          maxLength={120}
          placeholder="Нэр, материал эсвэл tag-аар хайх…"
        />
        <button type="submit">Хайх</button>
        {query && (
          <Link href="/kitchens" aria-label="Хайлт арилгах">
            <X size={16} />
          </Link>
        )}
      </Form>
      {tags.length > 0 && (
        <div className="kitchen-directory-tags" aria-label="Tag-аар хайх">
          {tags.map((tag) => (
            <Link
              key={tag}
              href={`/kitchens?q=${encodeURIComponent(tag)}`}
              aria-current={query === tag ? "page" : undefined}
            >
              #{tag}
            </Link>
          ))}
        </div>
      )}
      <p className="kitchen-directory-results">
        {query ? `«${query}» · ` : ""}
        {designs.length} загвар
      </p>
      {designs.length ? (
        <div className="directory-grid">
          {designs.map((design) => (
            <DirectoryCard
              key={design.id}
              href={`/kitchens/${design.slug}`}
              title={design.title}
              image={design.thumbnailUrl}
              badge={design.model ? "Гал тогоо · 3D" : "Гал тогоо"}
              eyebrow={design.storeName}
              tags={[
                `${design.roomWidthMm} × ${design.roomDepthMm} мм`,
                `${design.cabinetCount} модуль`,
              ]}
              summary={{
                label: design.pricingMode === "quote" ? "Үнэ" : "Эхлэх үнэ",
                value: kitchenPriceLabel(design),
                note: design.leadTimeDays
                  ? `${design.leadTimeDays} хоног`
                  : undefined,
              }}
              action="Загвар үзэх"
            />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-black/15 px-6 py-16 text-center">
          <CookingPot className="mx-auto text-ui-muted" size={42} />
          <h2 className="mt-4 text-xl font-semibold">
            {query
              ? "Хайлтад тохирох загвар олдсонгүй"
              : "Нийтлэгдсэн загвар хараахан алга"}
          </h2>
          <p className="mt-2 text-sm text-black/55">
            {query
              ? "Өөр нэр, материал эсвэл tag-аар хайгаарай."
              : "Үйлдвэрүүдийн эхний загварууд admin хяналтаар орж байна."}
          </p>
        </div>
      )}
    </div>
  );
}
