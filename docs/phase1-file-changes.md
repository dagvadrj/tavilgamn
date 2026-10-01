# Phase 1 — Файлын өөрчлөлтийн бүрэн жагсаалт

Огноо: 2026-10-01. Суурь Git commit: b039496.
Энэ жагсаалт нь Phase 1 болон planner style-ийн засварыг хамарсан commit хийгдээгүй төлөвийг суурь commit-той харьцуулсан.
Git дээр D харагдсан route файлуудыг шинэ замд нь байгаа эсэхээр шалгаж, жинхэнэ устгал болон шилжүүлэлтийг ялгасан.

## Товч дүн

- Үнэхээр устгасан: 3 файл.
- Шилжүүлсэн: 24 файл; 1 нь мөн агуулгын өөрчлөлттэй.
- Өмнөх замдаа өөрчилсөн: 75 файл.
- Шинээр нэмсэн: 22 файл (шилжүүлсэн файлуудыг давхар тоолоогүй).

## Энэ удаагийн planner засвар

Шалтгаан: panel-уудыг src/features рүү шилжүүлэхэд Tailwind-ийн content scan хуучин src/components, src/app, src/pages хавтсыг л хамарч байв.
Drawer-ийн өргөн, transform, desktop relative байрлалын utility style үүсээгүй учраас 3D хэсэг буруу баганад байрласан.

- [tailwind.config.ts](C:/Users/HiTech/Desktop/ProjectN2/tailwind.config.ts): бүх src доторх source файлыг scan хийхээр зассан.
- [tests/planner-styles.test.cjs](C:/Users/HiTech/Desktop/ProjectN2/tests/planner-styles.test.cjs): бодит Tailwind тохиргоогоор CSS үүсгэж, drawer-ийн mobile болон desktop style-ууд байгаа эсэхийг шалгана.
- [.gitignore](C:/Users/HiTech/Desktop/ProjectN2/.gitignore): энэ жагсаалтыг versioned баримт болгосон.
- [docs/phase1-verification.md](C:/Users/HiTech/Desktop/ProjectN2/docs/phase1-verification.md): өмнөх visual шалгалтын хязгаар болон шинэ шалгалтын үр дүнг тэмдэглэсэн.

## Үнэхээр устгасан 3 файл

- `src/components/PartnerMarquee.tsx` — Хэрэглэгдэхгүй component.
- `src/lib/stores.ts` — Static дэлгүүрийн давхардсан эх сурвалж; merchant_stores руу шилжүүлсэн.
- `src/three/kitchenMaterialTextures.tsx` — Давхардсан legacy файл; идэвхтэй src/three/kitchenMaterialTextures.ts хэвээр.

Эдгээрийн өмнөх хувилбар суурь Git commit-д байгаа, сэргээх боломжтой. GLB, захиалга, хэрэглэгчийн бүртгэл, database backup устгаагүй.

## Шилжүүлсэн файлууд — устгаагүй

| Хуучин зам | Одоогийн зам | Агуулга |
|---|---|---|
| `src/app/about/page.tsx` | [src/app/(shop)/about/page.tsx](C:/Users/HiTech/Desktop/ProjectN2/src/app/(shop)/about/page.tsx) | Хэвээр |
| `src/app/account/page.tsx` | [src/app/(shop)/account/page.tsx](C:/Users/HiTech/Desktop/ProjectN2/src/app/(shop)/account/page.tsx) | Хэвээр |
| `src/app/admin/admin.css` | [src/app/(admin)/admin/admin.css](C:/Users/HiTech/Desktop/ProjectN2/src/app/(admin)/admin/admin.css) | Хэвээр |
| `src/app/admin/page.tsx` | [src/app/(admin)/admin/page.tsx](C:/Users/HiTech/Desktop/ProjectN2/src/app/(admin)/admin/page.tsx) | Хэвээр |
| `src/app/cart/page.tsx` | [src/app/(shop)/cart/page.tsx](C:/Users/HiTech/Desktop/ProjectN2/src/app/(shop)/cart/page.tsx) | Хэвээр |
| `src/app/catalog/[category]/page.tsx` | [src/app/(shop)/catalog/[category]/page.tsx](C:/Users/HiTech/Desktop/ProjectN2/src/app/(shop)/catalog/[category]/page.tsx) | Хэвээр |
| `src/app/catalog/page.tsx` | [src/app/(shop)/catalog/page.tsx](C:/Users/HiTech/Desktop/ProjectN2/src/app/(shop)/catalog/page.tsx) | Хэвээр |
| `src/app/catalog/stores/[id]/page.tsx` | [src/app/(shop)/catalog/stores/[id]/page.tsx](C:/Users/HiTech/Desktop/ProjectN2/src/app/(shop)/catalog/stores/[id]/page.tsx) | Хэвээр |
| `src/app/checkout/page.tsx` | [src/app/(shop)/checkout/page.tsx](C:/Users/HiTech/Desktop/ProjectN2/src/app/(shop)/checkout/page.tsx) | Хэвээр |
| `src/app/kitchen/page.tsx` | [src/app/(planner)/kitchen/page.tsx](C:/Users/HiTech/Desktop/ProjectN2/src/app/(planner)/kitchen/page.tsx) | Хэвээр |
| `src/app/kitchens/[slug]/page.tsx` | [src/app/(shop)/kitchens/[slug]/page.tsx](C:/Users/HiTech/Desktop/ProjectN2/src/app/(shop)/kitchens/[slug]/page.tsx) | Хэвээр |
| `src/app/kitchens/page.tsx` | [src/app/(shop)/kitchens/page.tsx](C:/Users/HiTech/Desktop/ProjectN2/src/app/(shop)/kitchens/page.tsx) | Хэвээр |
| `src/app/login/page.tsx` | [src/app/(shop)/login/page.tsx](C:/Users/HiTech/Desktop/ProjectN2/src/app/(shop)/login/page.tsx) | Хэвээр |
| `src/app/merchant/merchant.css` | [src/app/(shop)/merchant/merchant.css](C:/Users/HiTech/Desktop/ProjectN2/src/app/(shop)/merchant/merchant.css) | Хэвээр |
| `src/app/merchant/page.tsx` | [src/app/(shop)/merchant/page.tsx](C:/Users/HiTech/Desktop/ProjectN2/src/app/(shop)/merchant/page.tsx) | Хэвээр |
| `src/app/orders/[id]/page.tsx` | [src/app/(shop)/orders/[id]/page.tsx](C:/Users/HiTech/Desktop/ProjectN2/src/app/(shop)/orders/[id]/page.tsx) | Хэвээр |
| `src/app/page.tsx` | [src/app/(shop)/page.tsx](C:/Users/HiTech/Desktop/ProjectN2/src/app/(shop)/page.tsx) | Нүүр хуудасны дэлгүүрүүдийг DB-оос уншдаг болгосон |
| `src/app/planner/page.tsx` | [src/app/(planner)/planner/page.tsx](C:/Users/HiTech/Desktop/ProjectN2/src/app/(planner)/planner/page.tsx) | Хэвээр |
| `src/app/product/[id]/page.tsx` | [src/app/(shop)/product/[id]/page.tsx](C:/Users/HiTech/Desktop/ProjectN2/src/app/(shop)/product/[id]/page.tsx) | Хэвээр |
| `src/app/register/page.tsx` | [src/app/(shop)/register/page.tsx](C:/Users/HiTech/Desktop/ProjectN2/src/app/(shop)/register/page.tsx) | Хэвээр |
| `src/app/stores/error.tsx` | [src/app/(shop)/stores/error.tsx](C:/Users/HiTech/Desktop/ProjectN2/src/app/(shop)/stores/error.tsx) | Хэвээр |
| `src/app/stores/loading.tsx` | [src/app/(shop)/stores/loading.tsx](C:/Users/HiTech/Desktop/ProjectN2/src/app/(shop)/stores/loading.tsx) | Хэвээр |
| `src/app/stores/page.tsx` | [src/app/(shop)/stores/page.tsx](C:/Users/HiTech/Desktop/ProjectN2/src/app/(shop)/stores/page.tsx) | Хэвээр |
| `src/app/wishlist/page.tsx` | [src/app/(shop)/wishlist/page.tsx](C:/Users/HiTech/Desktop/ProjectN2/src/app/(shop)/wishlist/page.tsx) | Хэвээр |

Route group-ийн (shop), (planner), (admin) нь нийтэд харагдах URL-ийг өөрчлөөгүй.

## Өөрчилсөн файлууд — өмнөх замдаа

- [.gitignore](C:/Users/HiTech/Desktop/ProjectN2/.gitignore)
- [README.md](C:/Users/HiTech/Desktop/ProjectN2/README.md)
- [src/app/api/admin/analytics/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/admin/analytics/route.ts)
- [src/app/api/admin/images/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/admin/images/route.ts)
- [src/app/api/admin/kitchen-material-textures/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/admin/kitchen-material-textures/route.ts)
- [src/app/api/admin/kitchen-materials/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/admin/kitchen-materials/route.ts)
- [src/app/api/admin/kitchen-modules/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/admin/kitchen-modules/route.ts)
- [src/app/api/admin/kitchen-render-jobs/[id]/generate/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/admin/kitchen-render-jobs/[id]/generate/route.ts)
- [src/app/api/admin/merchants/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/admin/merchants/route.ts)
- [src/app/api/admin/messages/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/admin/messages/route.ts)
- [src/app/api/admin/models/download/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/admin/models/download/route.ts)
- [src/app/api/admin/models/export/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/admin/models/export/route.ts)
- [src/app/api/admin/models/requests/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/admin/models/requests/route.ts)
- [src/app/api/admin/models/status/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/admin/models/status/route.ts)
- [src/app/api/admin/models/upload-complete/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/admin/models/upload-complete/route.ts)
- [src/app/api/admin/models/upload-url/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/admin/models/upload-url/route.ts)
- [src/app/api/admin/orders/[id]/confirm-transfer/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/admin/orders/[id]/confirm-transfer/route.ts)
- [src/app/api/admin/orders/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/admin/orders/route.ts)
- [src/app/api/admin/products/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/admin/products/route.ts)
- [src/app/api/admin/stores/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/admin/stores/route.ts)
- [src/app/api/admin/users/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/admin/users/route.ts)
- [src/app/api/contact/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/contact/route.ts)
- [src/app/api/kitchen-designs/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/kitchen-designs/route.ts)
- [src/app/api/kitchen-modules/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/kitchen-modules/route.ts)
- [src/app/api/kitchen-quotes/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/kitchen-quotes/route.ts)
- [src/app/api/kitchen/export/skp/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/kitchen/export/skp/route.ts)
- [src/app/api/kitchens/[id]/thumbnail/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/kitchens/[id]/thumbnail/route.ts)
- [src/app/api/kitchens/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/kitchens/route.ts)
- [src/app/api/merchant/images/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/merchant/images/route.ts)
- [src/app/api/merchant/kitchen-designs/[id]/media/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/merchant/kitchen-designs/[id]/media/route.ts)
- [src/app/api/merchant/kitchen-designs/[id]/renders/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/merchant/kitchen-designs/[id]/renders/route.ts)
- [src/app/api/merchant/kitchen-designs/[id]/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/merchant/kitchen-designs/[id]/route.ts)
- [src/app/api/merchant/kitchen-designs/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/merchant/kitchen-designs/route.ts)
- [src/app/api/merchant/kitchen-quotes/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/merchant/kitchen-quotes/route.ts)
- [src/app/api/merchant/orders/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/merchant/orders/route.ts)
- [src/app/api/merchant/products/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/merchant/products/route.ts)
- [src/app/api/models/[id]/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/models/[id]/route.ts)
- [src/app/api/models/files/[id]/[...filename]/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/models/files/[id]/[...filename]/route.ts)
- [src/app/api/models/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/models/route.ts)
- [src/app/api/models/upload/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/models/upload/route.ts)
- [src/app/api/orders/[id]/payment/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/orders/[id]/payment/route.ts)
- [src/app/api/orders/[id]/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/orders/[id]/route.ts)
- [src/app/api/orders/quote/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/orders/quote/route.ts)
- [src/app/api/orders/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/orders/route.ts)
- [src/app/api/payments/callback/[method]/[id]/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/payments/callback/[method]/[id]/route.ts)
- [src/app/api/payments/socialpay/notify/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/payments/socialpay/notify/route.ts)
- [src/app/api/products/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/products/route.ts)
- [src/app/api/stores/featured/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/stores/featured/route.ts)
- [src/app/api/stores/route.ts](C:/Users/HiTech/Desktop/ProjectN2/src/app/api/stores/route.ts)
- [src/app/globals.css](C:/Users/HiTech/Desktop/ProjectN2/src/app/globals.css)
- [src/app/layout.tsx](C:/Users/HiTech/Desktop/ProjectN2/src/app/layout.tsx)
- [src/components/Footer.tsx](C:/Users/HiTech/Desktop/ProjectN2/src/components/Footer.tsx)
- [src/components/Header.tsx](C:/Users/HiTech/Desktop/ProjectN2/src/components/Header.tsx)
- [src/components/ModularKitchenPlanner.tsx](C:/Users/HiTech/Desktop/ProjectN2/src/components/ModularKitchenPlanner.tsx)
- [src/components/RoomPlanner.tsx](C:/Users/HiTech/Desktop/ProjectN2/src/components/RoomPlanner.tsx)
- [src/components/room-planner.css](C:/Users/HiTech/Desktop/ProjectN2/src/components/room-planner.css)
- [src/lib/catalogServer.ts](C:/Users/HiTech/Desktop/ProjectN2/src/lib/catalogServer.ts)
- [src/lib/kitchenMarketplaceHttp.ts](C:/Users/HiTech/Desktop/ProjectN2/src/lib/kitchenMarketplaceHttp.ts)
- [src/lib/merchantServer.ts](C:/Users/HiTech/Desktop/ProjectN2/src/lib/merchantServer.ts)
- [src/lib/products.ts](C:/Users/HiTech/Desktop/ProjectN2/src/lib/products.ts)
- [src/lib/storeDirectory.ts](C:/Users/HiTech/Desktop/ProjectN2/src/lib/storeDirectory.ts)
- [src/lib/supabase/admin.ts](C:/Users/HiTech/Desktop/ProjectN2/src/lib/supabase/admin.ts)
- [src/lib/supabase/client.ts](C:/Users/HiTech/Desktop/ProjectN2/src/lib/supabase/client.ts)
- [src/lib/supabase/requireAdmin.ts](C:/Users/HiTech/Desktop/ProjectN2/src/lib/supabase/requireAdmin.ts)
- [src/lib/supabase/requireMerchant.ts](C:/Users/HiTech/Desktop/ProjectN2/src/lib/supabase/requireMerchant.ts)
- [src/lib/supabase/requireUser.ts](C:/Users/HiTech/Desktop/ProjectN2/src/lib/supabase/requireUser.ts)
- [src/lib/types.ts](C:/Users/HiTech/Desktop/ProjectN2/src/lib/types.ts)
- [src/store/auth.ts](C:/Users/HiTech/Desktop/ProjectN2/src/store/auth.ts)
- [tailwind.config.ts](C:/Users/HiTech/Desktop/ProjectN2/tailwind.config.ts)
- [tests/account-usability.test.cjs](C:/Users/HiTech/Desktop/ProjectN2/tests/account-usability.test.cjs)
- [tests/inventory.test.cjs](C:/Users/HiTech/Desktop/ProjectN2/tests/inventory.test.cjs)
- [tests/kitchen-integration.test.cjs](C:/Users/HiTech/Desktop/ProjectN2/tests/kitchen-integration.test.cjs)
- [tests/merchant-db.test.cjs](C:/Users/HiTech/Desktop/ProjectN2/tests/merchant-db.test.cjs)
- [tests/store-directory.test.cjs](C:/Users/HiTech/Desktop/ProjectN2/tests/store-directory.test.cjs)
- [tsconfig.json](C:/Users/HiTech/Desktop/ProjectN2/tsconfig.json)

Мөн шилжүүлэхдээ өөрчилсөн файл: [src/app/(shop)/page.tsx](C:/Users/HiTech/Desktop/ProjectN2/src/app/(shop)/page.tsx).

## Шинээр нэмсэн файлууд

- [docs/architecture.md](C:/Users/HiTech/Desktop/ProjectN2/docs/architecture.md)
- [docs/data-dictionary.md](C:/Users/HiTech/Desktop/ProjectN2/docs/data-dictionary.md)
- [docs/phase1-file-changes.md](C:/Users/HiTech/Desktop/ProjectN2/docs/phase1-file-changes.md)
- [docs/phase1-verification.md](C:/Users/HiTech/Desktop/ProjectN2/docs/phase1-verification.md)
- [docs/role-permissions.md](C:/Users/HiTech/Desktop/ProjectN2/docs/role-permissions.md)
- [src/app/(admin)/layout.tsx](C:/Users/HiTech/Desktop/ProjectN2/src/app/(admin)/layout.tsx)
- [src/app/(planner)/layout.tsx](C:/Users/HiTech/Desktop/ProjectN2/src/app/(planner)/layout.tsx)
- [src/app/(shop)/layout.tsx](C:/Users/HiTech/Desktop/ProjectN2/src/app/(shop)/layout.tsx)
- [src/components/AuthBootstrap.tsx](C:/Users/HiTech/Desktop/ProjectN2/src/components/AuthBootstrap.tsx)
- [src/features/kitchen-planner/components/PlannerPanels.tsx](C:/Users/HiTech/Desktop/ProjectN2/src/features/kitchen-planner/components/PlannerPanels.tsx)
- [src/features/kitchen-planner/hooks/useKitchenCatalog.ts](C:/Users/HiTech/Desktop/ProjectN2/src/features/kitchen-planner/hooks/useKitchenCatalog.ts)
- [src/features/room-planner/components/PlannerPanels.tsx](C:/Users/HiTech/Desktop/ProjectN2/src/features/room-planner/components/PlannerPanels.tsx)
- [src/features/room-planner/hooks/useRoomPlannerUi.ts](C:/Users/HiTech/Desktop/ProjectN2/src/features/room-planner/hooks/useRoomPlannerUi.ts)
- [src/lib/api/errors.ts](C:/Users/HiTech/Desktop/ProjectN2/src/lib/api/errors.ts)
- [src/lib/catalogCategories.ts](C:/Users/HiTech/Desktop/ProjectN2/src/lib/catalogCategories.ts)
- [src/lib/supabase/authorize.ts](C:/Users/HiTech/Desktop/ProjectN2/src/lib/supabase/authorize.ts)
- [src/lib/supabase/database.ts](C:/Users/HiTech/Desktop/ProjectN2/src/lib/supabase/database.ts)
- [src/lib/supabase/database.types.ts](C:/Users/HiTech/Desktop/ProjectN2/src/lib/supabase/database.types.ts)
- [src/lib/supabase/json.ts](C:/Users/HiTech/Desktop/ProjectN2/src/lib/supabase/json.ts)
- [supabase/migrations/20261001092640_architecture_store_directory.sql](C:/Users/HiTech/Desktop/ProjectN2/supabase/migrations/20261001092640_architecture_store_directory.sql)
- [tests/architecture.test.cjs](C:/Users/HiTech/Desktop/ProjectN2/tests/architecture.test.cjs)
- [tests/planner-styles.test.cjs](C:/Users/HiTech/Desktop/ProjectN2/tests/planner-styles.test.cjs)

## Build/cache файлууд

.next, .next-phase1 болон decoder sync output нь generated/ignored тул дээрх source жагсаалтад ороогүй.
Зассан layout-ийн зураг: [planner-fixed-desktop.jpg](C:/Users/HiTech/Desktop/ProjectN2/docs/planner-fixed-desktop.jpg). Энэ нь ignored шалгалтын artifact, source файл биш.
Хуучин dev cache-ийг устгалгүй .next-pre-phase1-20261001 руу нөөцлөсөн. next-env.d.ts нь эцэстээ суурь төлөвтэй адил тул өөрчилсөн жагсаалтад ороогүй.

