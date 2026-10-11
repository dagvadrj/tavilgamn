"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
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
  Plus,
  ArrowUpRight,
} from "lucide-react";
import { OrderHistory } from "@/components/OrderHistory";
import { SavedKitchenList } from "@/components/SavedKitchenList";
import { KitchenQuoteHistory } from "@/components/KitchenQuoteHistory";
import { useAuth } from "@/store/auth";
import { useWishlist } from "@/store/wishlist";
import { useDesigns } from "@/store/designs";
import { priceFor } from "@/lib/products";
import { getProduct, useCatalog } from "@/store/catalog";
import { CatalogStatus } from "@/components/CatalogStatus";
import { formatPrice } from "@/lib/format";
import "./account.css";

export default function AccountPage() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const role = useAuth((s) => s.role);
  const initialized = useAuth((state) => state.initialized);
  const initializeAuth = useAuth((state) => state.initialize);
  const signOut = useAuth((s) => s.signOut);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const signOutPending = useRef(false);
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
    <div className="account-layout">
      <aside className="account-sidebar" aria-label="Бүртгэлийн цэс">
        <div className="account-identity">
          <div className="account-avatar" aria-hidden="true">
            {user.name[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="account-identity-name">{user.name}</p>
            <p className="account-muted break-all text-xs">{user.email}</p>
            <span className="account-role">
              {role === "admin"
                ? "Админ"
                : role === "merchant"
                  ? "Худалдаа эрхлэгч"
                  : "Хэрэглэгч"}
            </span>
          </div>
        </div>
        <nav className="account-nav" aria-label="Миний бүртгэл">
          {role === "admin" && (
            <Link
              href="/admin"
              className="account-nav-link account-portal-link"
            >
              <LayoutGrid className="h-4 w-4" />
              Удирдлага
            </Link>
          )}
          {role === "merchant" && (
            <Link
              href="/merchant"
              className="account-nav-link account-portal-link"
            >
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
            <a key={n.href} href={n.href} className="account-nav-link">
              <n.icon className="h-4 w-4" />
              {n.label}
            </a>
          ))}
        </nav>
        <button
          type="button"
          disabled={signingOut}
          onClick={async () => {
            if (signOutPending.current) return;
            signOutPending.current = true;
            setSigningOut(true);
            setSignOutError(null);
            try {
              await signOut();
              window.location.replace("/login");
            } catch {
              setSignOutError("Бүртгэлээс гарч чадсангүй. Дахин оролдоно уу.");
            } finally {
              signOutPending.current = false;
              setSigningOut(false);
            }
          }}
          className="account-signout"
        >
          <LogOut className="h-4 w-4" /> {signingOut ? "Гарч байна…" : "Гарах"}
        </button>
        {signOutError && (
          <p role="alert" className="text-sm text-red-600">
            {signOutError}
          </p>
        )}
      </aside>

      <div className="account-content">
        <section id="profile" className="account-profile account-card">
          <p className="account-eyebrow">Миний бүртгэл</p>
          <h1>Профайл</h1>
          <p className="account-muted mt-2 text-sm">
            Таны мэдээлэл, хадгалсан загварууд болон захиалга нэг дор.
          </p>
          <dl className="account-profile-details">
            <div>
              <dt>Нэр</dt>
              <dd className="mt-1 font-medium">{user.name}</dd>
            </div>
            <div>
              <dt>Имэйл</dt>
              <dd className="mt-1 break-all font-medium">{user.email}</dd>
            </div>
          </dl>
        </section>
        <section id="designs">
          {(catalog.loading || !catalog.ready) && (
            <CatalogStatus
              loading={catalog.loading}
              error={catalog.error}
              retry={() => void catalog.refresh()}
            />
          )}
          <div className="account-section-heading">
            <div>
              <p className="account-eyebrow">Хадгалсан өрөөний загвар</p>
              <h2>
                Таны загварууд{" "}
                <span className="account-count">{designs.length}</span>
              </h2>
            </div>
            <Link
              href="/planner"
              className="account-button account-button-primary"
            >
              <Plus size={16} aria-hidden="true" />
              Шинэ загвар
            </Link>
          </div>
          {designs.length === 0 ? (
            <div className="account-empty mt-5">
              <LayoutGrid size={28} aria-hidden="true" />
              <p>
                Та одоохондоо ямар нэг загвар хадгалаагүй байна. Төлөвлөгч дээр
                эхний загвараа үүсгэнэ үү.
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
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
                  <div key={d.id} className="account-card account-room-card">
                    <div>
                      <p className="font-medium">{d.name}</p>
                      <p className="account-muted mt-1 text-xs">
                        {d.pieces.length} тавилга ·{" "}
                        {catalog.ready
                          ? formatPrice(total)
                          : "Үнэ ачаалагдаагүй"}
                      </p>
                      <p className="account-muted mt-2 text-xs">
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
                        className="account-icon-button account-danger"
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

        <section id="kitchen-garniture" className="scroll-mt-24">
          <div className="account-section-heading">
            <div>
              <p className="account-eyebrow">Хадгалсан гарнитур</p>
              <h2>Миний гал тогооны гарнитур</h2>
            </div>
            <Link href="/kitchen" className="account-button">
              <Plus size={16} aria-hidden="true" />
              Шинэ гарнитур
            </Link>
          </div>
          <SavedKitchenList variant="account" />
        </section>
        <section id="kitchen-quotes" className="scroll-mt-24">
          <p className="account-eyebrow">Marketplace</p>
          <h2 className="mb-5">Гал тогооны үнийн хүсэлт</h2>
          <KitchenQuoteHistory />
        </section>
        <section id="orders">
          <p className="account-eyebrow">Захиалгын түүх</p>
          <h2>Захиалга</h2>
          <OrderHistory />
        </section>

        <section id="wishlist">
          {(catalog.loading || !catalog.ready) && (
            <CatalogStatus
              loading={catalog.loading}
              error={catalog.error}
              retry={() => void catalog.refresh()}
            />
          )}
          <div className="account-section-heading">
            <div>
              <p className="account-eyebrow">Хүслийн жагсаалт</p>
              <h2>
                Хадгалсан тавилга{" "}
                <span className="account-count">{wishlist.length}</span>
              </h2>
            </div>
            <Link href="/wishlist" className="account-button">
              Бүгдийг үзэх <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
          {wishlist.length === 0 && (
            <div className="account-empty">
              <Heart size={28} aria-hidden="true" />
              <p>Таалагдсан тавилгынхаа зүрх дээр дарж энд хадгалаарай.</p>
              <Link href="/catalog" className="account-button">
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
                  className="account-wishlist-card group"
                >
                  <div className="relative aspect-square overflow-hidden rounded-xl bg-[#f4f4f5]">
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      sizes="200px"
                      className="object-cover transition group-hover:scale-105"
                    />
                  </div>
                  <p className="mt-2 truncate text-sm">{product.name}</p>
                  <p className="mt-1 text-sm font-semibold">
                    {formatPrice(product.basePrice)}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
