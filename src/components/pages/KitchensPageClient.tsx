import type { PageData } from "@/lib/pageData";
import { PlannerLink as Link } from "@/components/PlannerLink";
import { CookingPot } from "lucide-react";
import { kitchenPriceLabel } from "@/lib/kitchenMarketplace";
import { DirectoryHeading } from "@/components/DirectoryHeading";
import { DirectoryCard } from "@/components/DirectoryCard";
import Form from "next/form";
import { Search, X } from "lucide-react";
import { kitchenDesignMatchesSearch } from "@/lib/kitchenListingSuggestions";
import { sortByRoomMatch, type KitchenBuyerRoom } from "@/lib/kitchenRoomMatch";
import { KitchenRoomForm } from "@/components/KitchenRoomForm";

export function KitchensContent({
  allDesigns,
  query,
  room = null,
}: {
  allDesigns: PageData["kitchens"]["designs"];
  query: string;
  room?: KitchenBuyerRoom | null;
}) {
  const found = allDesigns.filter((design) =>
    kitchenDesignMatchesSearch(design, query),
  );
  const ranked = room
    ? sortByRoomMatch(found, room)
    : found.map((design) => ({ design, match: null }));
  const designs = ranked.map((item) => item.design);
  const fitting = ranked.filter((item) => item.match?.fits).length;
  const roomQuery = room ? `w=${room.widthMm}&d=${room.depthMm}` : "";
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
        {room && <input type="hidden" name="w" value={room.widthMm} />}
        {room && <input type="hidden" name="d" value={room.depthMm} />}
        <button type="submit">Хайх</button>
        {query && (
          <Link href={roomQuery ? `/kitchens?${roomQuery}` : "/kitchens"} aria-label="Хайлт арилгах">
            <X size={16} />
          </Link>
        )}
      </Form>
      {tags.length > 0 && (
        <div className="kitchen-directory-tags" aria-label="Tag-аар хайх">
          {tags.map((tag) => (
            <Link
              key={tag}
              href={`/kitchens?q=${encodeURIComponent(tag)}${roomQuery ? `&${roomQuery}` : ""}`}
              aria-current={query === tag ? "page" : undefined}
            >
              #{tag}
            </Link>
          ))}
        </div>
      )}
      <KitchenRoomForm room={room} query={query} />
      <p className="kitchen-directory-results">
        {query ? `«${query}» · ` : ""}
        {designs.length} загвар
        {room ? ` · ${fitting} нь таны ${room.widthMm} × ${room.depthMm} мм өрөөнд таарна` : ""}
      </p>
      {designs.length ? (
        <div className="directory-grid">
          {ranked.map(({ design, match }) => (
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
              status={match ? { tone: match.fits ? "ok" : "warn", label: match.label } : undefined}
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
