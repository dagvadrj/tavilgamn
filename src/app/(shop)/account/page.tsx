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
  Store,
  MessageSquareQuote,
} from "lucide-react";
import { OrderHistory } from "@/components/OrderHistory";
import { SavedKitchenList } from "@/components/SavedKitchenList";
import { SavedRoomList } from "@/components/SavedRoomList";
import { KitchenQuoteHistory } from "@/components/KitchenQuoteHistory";
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
      <div className="grid min-h-[50vh] place-items-center text-sm text-[color:var(--market-muted,#6C726B)]">
        Хэрэглэгчийн мэдээллийг ачаалж байна…
      </div>
    );
  }
  return (
    <div className="shop-container account-layout">
      <aside className="account-sidebar shop-panel">
        <div className="account-identity">
          <div className="account-avatar" aria-hidden="true">
            {user.name.trim()[0]?.toUpperCase() || "Х"}
          </div>
          <strong>{user.name}</strong>
          <p>{user.email}</p>
        </div>
        <nav className="account-navigation" aria-label="Миний бүртгэлийн цэс">
          {role === "admin" && (
            <Link href="/admin" className="font-medium">
              <LayoutGrid className="h-4 w-4" />
              Удирдлага
            </Link>
          )}
          {role === "merchant" && (
            <Link href="/merchant" className="font-medium">
              <Store className="h-4 w-4" />
              Миний дэлгүүр
            </Link>
          )}
          {[
            { href: "#designs", label: "Хадгалсан загвар", icon: LayoutGrid },
            {
              href: "#kitchen-garniture",
              label: "Гал тогооны гарнитур",
              icon: LayoutGrid,
            },
            {
              href: "#kitchen-quotes",
              label: "Үнийн хүсэлт",
              icon: MessageSquareQuote,
            },
            { href: "#orders", label: "Захиалга", icon: Package },
            { href: "/wishlist", label: "Хүслийн жагсаалт", icon: Heart },
            { href: "#profile", label: "Профайл", icon: User },
          ].map((n) => (
            <a key={n.href} href={n.href}>
              <n.icon className="h-4 w-4" />
              {n.label}
            </a>
          ))}
        </nav>
        <button
          onClick={async () => {
            await signOut();
            router.replace("/login");
            router.refresh();
          }}
          type="button"
          className="account-signout"
        >
          <LogOut className="h-4 w-4" /> Гарах
        </button>
      </aside>

      <div className="account-content">
        <header>
          <p className="account-eyebrow">ТАНЫ ОРОН ЗАЙ</p>
          <h1 className="font-semibold">Миний бүртгэл</h1>
          <p className="shop-muted mt-2 text-sm">
            Загвар, захиалга болон хадгалсан тавилгаа нэг дороос.
          </p>
        </header>
        <section id="profile" className="shop-panel">
          <div className="account-section-heading">
            <h2>Профайл</h2>
            <User size={20} className="shop-muted" aria-hidden="true" />
          </div>
          <dl className="mt-6 grid gap-5 text-sm sm:grid-cols-2">
            <div>
              <dt className="shop-muted">Нэр</dt>
              <dd className="mt-1 break-words font-medium">{user.name}</dd>
            </div>
            <div>
              <dt className="shop-muted">Имэйл</dt>
              <dd className="mt-1 break-all font-medium">{user.email}</dd>
            </div>
          </dl>
        </section>
        <section id="designs" className="shop-panel">
          {(catalog.loading || !catalog.ready) && (
            <CatalogStatus
              loading={catalog.loading}
              error={catalog.error}
              retry={() => void catalog.refresh()}
            />
          )}
          <div className="account-section-heading">
            <div>
              <p className="account-eyebrow">Өрөөний загвар</p>
              <h2>Таны загварууд</h2>
            </div>
            <Link href="/planner" className="btn-primary">
              Шинэ загвар
            </Link>
          </div>
          <SavedRoomList />
          <h3 className="mt-6 mb-3">Энэ төхөөрөмжийн загварууд</h3>
          {designs.length === 0 ? (
            <div className="shop-empty !px-5 !py-8">
              <LayoutGrid size={28} aria-hidden="true" />
              <p>
                Та одоохондоо ямар нэг загвар хадгалаагүй байна. Төлөвлөгч дээр
                эхний загвараа үүсгэнэ үү.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
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
                  <div key={d.id} className="account-design-card">
                    <div>
                      <p className="font-medium">{d.name}</p>
                      <p className="mt-1 text-xs text-[color:var(--market-muted,#737D6C)]">
                        {d.pieces.length} тавилга ·{" "}
                        {catalog.ready
                          ? formatPrice(total)
                          : "Үнэ ачаалагдаагүй"}
                      </p>
                      <p className="mt-1 text-xs text-[color:var(--market-muted,#737D6C)]">
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
                        className="account-icon-button"
                      >
                        <Maximize className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => {
                          if (
                            window.confirm(
                              `“${d.name}” загварыг устгах уу? Устгасан загварыг буцаах боломжгүй.`,
                            )
                          ) {
                            deleteDesign(d.id);
                          }
                        }}
                        aria-label={`${d.name} загварыг устгах`}
                        type="button"
                        className="account-icon-button delete"
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

        <section id="kitchen-garniture" className="shop-panel">
          <div className="account-section-heading">
            <h2>Миний гал тогооны гарнитур</h2>
          </div>
          <SavedKitchenList />
        </section>
        <section id="kitchen-quotes" className="shop-panel">
          <p className="account-eyebrow">Marketplace</p>
          <div className="account-section-heading">
            <h2>Гал тогооны үнийн хүсэлт</h2>
          </div>
          <KitchenQuoteHistory />
        </section>
        <section id="orders" className="shop-panel">
          <p className="account-eyebrow">Захиалгын түүх</p>
          <div className="account-section-heading">
            <h2>Захиалга</h2>
          </div>
          <OrderHistory />
        </section>

        <section id="wishlist" className="shop-panel">
          {(catalog.loading || !catalog.ready) && (
            <CatalogStatus
              loading={catalog.loading}
              error={catalog.error}
              retry={() => void catalog.refresh()}
            />
          )}
          <p className="account-eyebrow">Хүслийн жагсаалт</p>
          <div className="account-section-heading">
            <h2>{wishlist.length} тавилга хадгалсан</h2>
            <Link href="/wishlist" className="text-link">
              Бүгдийг үзэх
            </Link>
          </div>
          {wishlist.length === 0 && (
            <div className="shop-empty !py-8">
              <Heart size={28} aria-hidden="true" />
              <p>Таалагдсан тавилгаа хадгалаад эндээс дахин олоорой.</p>
              <Link href="/catalog" className="btn-ghost">
                Тавилга үзэх
              </Link>
            </div>
          )}
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
                  <div className="relative aspect-square overflow-hidden rounded-xl bg-[var(--market-hover,#EEEEE7)]">
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
