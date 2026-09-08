"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  LogOut,
  User,
  Heart,
  Package,
  LayoutGrid,
  Maximize,
  Trash2,
} from "lucide-react";
import { OrderHistory } from "@/components/OrderHistory";
import { useAuth } from "@/store/auth";
import { useWishlist } from "@/store/wishlist";
import { useDesigns } from "@/store/designs";
import { priceFor } from "@/lib/products";
import { getProduct, useCatalog } from "@/store/catalog";
import { CatalogStatus } from "@/components/CatalogStatus";
import { formatPrice } from "@/lib/format";

export default function AccountPage() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const role = useAuth((s) => s.role);
  const initialized = useAuth((state) => state.initialized);
  const initializeAuth = useAuth((state) => state.initialize);
  const signOut = useAuth((s) => s.signOut);
  const wishlist = useWishlist((s) => s.items);
  const designs = useDesigns((s) => s.designs);
  const deleteDesign = useDesigns((s) => s.deleteDesign);
  const loadDesign = useDesigns((s) => s.loadDesign);
  const catalog = useCatalog();
  useEffect(() => {
    void initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    if (initialized && !user) {
      router.replace("/login");
    }
  }, [initialized, user, router]);

  if (!initialized || !user) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-sm text-[#6C726B]">
        Хэрэглэгчийн мэдээллийг ачаалж байна…
      </div>
    );
  }
  return (
    <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 md:grid-cols-[260px_1fr]">
      <aside>
        <div className="rounded-lg border border-[#293C32]/10 bg-[#FFFFFF] p-6">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-[#EEEEE7] font-mono text-2xl text-[#293C32]">
            {user.name[0]?.toUpperCase()}
          </div>
          <p className="mt-3 font-medium">{user.name}</p>
          <p className="text-xs text-[#737D6C]">{user.email}</p>
          <button
            onClick={async () => {
              await signOut();
              router.replace("/login");
              router.refresh();
            }}
            className="mt-6 inline-flex items-center gap-2 text-sm text-[#6C726B] hover:text-[#293C32]"
          >
            <LogOut className="h-4 w-4" /> Гарах
          </button>
        </div>
        <nav className="mt-4 space-y-1 text-sm">
          {role === "admin" && <Link href="/admin" className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 font-medium text-[#42634f]"><LayoutGrid className="h-4 w-4" />Удирдлага</Link>}
          {[
            { href: "#designs", label: "Хадгалсан загвар", icon: LayoutGrid },
            { href: "#orders", label: "Захиалга", icon: Package },
            { href: "/wishlist", label: "Хүслийн жагсаалт", icon: Heart },
            { href: "#profile", label: "Профайл", icon: User },
          ].map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-[#6C726B] hover:bg-[#293C32]/5 hover:text-[#293C32]"
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </a>
          ))}
        </nav>
      </aside>

      <div className="space-y-10">
        <section id="profile" className="scroll-mt-24 rounded-lg border border-[#293C32]/10 bg-white p-6">
          <h1 className="text-3xl text-[#293C32]">Профайл</h1>
          <dl className="mt-6 grid gap-5 text-sm sm:grid-cols-2">
            <div><dt className="text-[#737D6C]">Нэр</dt><dd className="mt-1 font-medium">{user.name}</dd></div>
            <div><dt className="text-[#737D6C]">Имэйл</dt><dd className="mt-1 break-all font-medium">{user.email}</dd></div>
          </dl>
        </section>
        <section id="designs">
          {(catalog.loading || !catalog.ready) && <CatalogStatus loading={catalog.loading} error={catalog.error} retry={() => void catalog.refresh()} />}
          <div className="flex items-end justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-wide text-[#737D6C]">
                Хадгалсан өрөөний загвар
              </p>
              <h2 className="text-3xl text-[#293C32]">Таны загварууд</h2>
            </div>
            <Link
              href="/planner"
              className="rounded-sm bg-[#293C32] px-6 py-3 text-sm font-medium text-[#FFFFFF] hover:bg-[#3C5446] transition inline-flex items-center gap-2"
            >
              Шинэ загвар
            </Link>
          </div>
          {designs.length === 0 ? (
            <div className="mt-6 rounded-lg border border-dashed border-[#293C32]/20 p-12 text-center">
              <p className="text-sm text-[#737D6C]">
                Та одоохондоо ямар нэг загвар хадгалаагүй байна. Төлөвлөгч дээр
                эхний загвараа үүсгэнэ үү.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {designs.map((d) => {
                const total = d.pieces.reduce((sum, piece) => {
                  const product = getProduct(piece.productId);

                  return (
                    sum +
                    (product
                      ? priceFor(product, piece.color, piece.material)
                      : 0)
                  );
                }, 0);
                return (
                  <div
                    key={d.id}
                    className="flex justify-between rounded-lg border border-[#293C32]/10 bg-[#FFFFFF] p-5"
                  >
                    <div>
                      <p className="font-medium">{d.name}</p>
                      <p className="mt-1 text-xs text-[#737D6C]">
                        {d.pieces.length} тавилга · {catalog.ready ? formatPrice(total) : "Үнэ ачаалагдаагүй"}
                      </p>
                      <p className="mt-1 text-xs text-[#737D6C]/70">
                        Сүүлд шинэчилсэн{" "}
                        {new Date(d.updatedAt).toLocaleDateString("mn-MN", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href="/planner"
                        onClick={() => loadDesign(d.id)}
                        aria-label={`${d.name} загварыг нээх`}
                        className="grid h-9 w-9 place-items-center rounded-full border border-[#293C32]/12 hover:bg-[#293C32]/5"
                      >
                        <Maximize className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => {
                          if (window.confirm(`“${d.name}” загварыг устгах уу? Устгасан загварыг буцаах боломжгүй.`)) {
                            deleteDesign(d.id);
                          }
                        }}
                        aria-label={`${d.name} загварыг устгах`}
                        className="grid h-9 w-9 place-items-center rounded-full border border-[#293C32]/12 text-[#AD6547] hover:bg-[#AD6547]/5"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section id="orders">
          <p className="font-mono text-xs uppercase tracking-wide text-[#737D6C]">
            Захиалгын түүх
          </p>
          <h2 className="text-3xl text-[#293C32]">Захиалга</h2>
          <OrderHistory />
        </section>

        <section id="wishlist">
          {(catalog.loading || !catalog.ready) && <CatalogStatus loading={catalog.loading} error={catalog.error} retry={() => void catalog.refresh()} />}
          <p className="font-mono text-xs uppercase tracking-wide text-[#737D6C]">
            Хүслийн жагсаалт
          </p>
          <h2 className="text-3xl text-[#293C32]">
            {wishlist.length} тавилга хадгалсан
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {wishlist.slice(0, 4).map((w) => {
              const product = getProduct(w.productId);
              if (!product) return null;
              return (
                <Link
                  key={product.id}
                  href={`/product/${product.id}`}
                  className="group"
                >
                  <div className="relative aspect-square overflow-hidden rounded-xl bg-[#EEEEE7]">
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      sizes="200px"
                      className="object-cover transition group-hover:scale-105"
                    />
                  </div>
                  <p className="mt-2 truncate text-sm">{product.name}</p>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
