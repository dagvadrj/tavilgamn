# tavilga.mn — Publish хүртэлх 14 хоногийн аудит

Аудит: 2026-10-09, Asia/Ulaanbaatar. Зорилго: эхний 10 хоногт худалдааны үндсэн урсгал, өрөө/гал тогооны төлөвлөгчийг release хийхэд бэлэн болгох; 11–14 дэх хоногийг шалгалт, засвар, publish-д үлдээх.

## 1. Гол дүгнэлт

Кодын үндсэн бүтэц ажиллаж байна. Харин **одоогийн локал тохиргоогоор бодит төлбөр авах боломжгүй**. Build амжилттай болсон нь худалдаанд нээхэд бэлэн гэсэн баталгаа биш. Гол эрсдэл нь төлбөрийн тохиргоо, каталогийн чанар, deployment/DB сэргээгдэх байдал, auth урсгалын дутуу хэсэг, хэт том client bundle байна.

10 хоногт дуусгах төлөвлөгөө боломжтой эсэх нь төлбөрийн эрх, домэйн/hosting, бизнесийн бодит контент эхний 1–2 хоногт ирэхээс хамаарна. Доорх нь хийх ажлын төлөвлөгөө; хугацааны баталгаа биш. Бүх BNPL provider, бүрэн автомат SMS, шууд SKP converter, customer AI render-ийг зэрэг нэмэхийг энэ хугацаанд амлаж болохгүй.

“Бүрэн website” гэсэн release шалгуур: хэрэглэгч бараагаа олж үзэх → бүртгүүлэх/нэвтрэх → сагс → серверээр баталгаажсан захиалга → дор хаяж нэг бодит төлбөрийн арга → админ/мерчант захиалга боловсруулах → хүргэлтийн төлөв → цуцлалт/буцаалтын ажиллагаа. Төлөвлөгч дээр хэмжээ, байрлал, save/load, экспорт ажиллана. Харагдаж буй боломж бүр ажилладаг эсвэл боломжгүй төлөвөө ойлгомжтой харуулдаг байна.

## 2. Юуг бодитоор шалгасан бэ

- `npm run env:check:production`: **унасан**. `APP_URL`, `QPAY_USERNAME`, `QPAY_PASSWORD`, `QPAY_INVOICE_CODE` дутуу.
- `npm run styles:check`: **давсан**, 31 CSS файл.
- `npm run lint`: **давсан**.
- `npm run typecheck`: **давсан**.
- `npm test`: **513 pass, 0 fail, 0 skipped**, 30.31 секунд. Үндсэн TAP жагсаалт 484 бөгөөд nested тесттэй нийлээд 513.
- `NEXT_DIST_DIR=.next-release-audit npm run build`: **давсан**, нийт 89.49 секунд; compilation 37.2 секунд.
- Тусдаа түр production серверт public GET хүсэлтүүд хийсэн. Серверийг дараа нь хаасан. Өгөгдөл бичих, захиалга үүсгэх, төлбөр хийх, publish хийх ажиллагаа хийгээгүй.
- Build-ийн автоматаар өөрчилсөн `tsconfig.json`, `next-env.d.ts`-ийн өөрчлөлтийг буцаасан. Application код өөрчлөөгүй. `.next-release-audit/` нь ignored build output.

Хязгаар: браузерын LCP/INP/CLS, утасны GPU/FPS, production hosting, бодит provider төлбөр, email delivery, бүтэн clean DB replay/backup restore-ийг энэ аудитад шалгаагүй. Доорх runtime хэмжилт нь localhost HTTP response body дуусах хугацаа; хэрэглэгчийн дэлгэц дээр бэлэн болох хугацаа биш.

Хадгалсан баримт: [production build log](release-audit-evidence/build.txt), [public GET хэмжилт](release-audit-evidence/runtime.jsonl), [тестийн төгсгөлийн үр дүн](release-audit-evidence/tests-summary.txt). Build log дахь түр distDir өөрчлөлтийг аудитын дараа source-оос буцаасан.

## 3. Runtime-ийн бодит хэмжилт

Production build, нэг түр Node worker, бодит одоогийн backend, public GET. Өөр өөр endpoint-ийн хүсэлтүүдийг дараалан хийсэн; өндөр ачааллын туршилт биш.

- `/`: эхний хүсэлт **1758 ms**; дараагийн 3 хүсэлт **67 / 40 / 36 ms**. Warm HTML/RSC body 329,320 bytes, compression-гүй уншсан хэмжээ.
- `/api/products`: нүүр хуудас cache халаасны дараах эхний хүсэлт **16 ms**; дараагийн **5 / 5 / 3 ms**. 32 бараа, 35,573 bytes; `Server-Timing` нь cache hit, handler 0.0–0.1 ms.
- `/stores`: **189 / 27 / 25 ms**.
- `/kitchens`: **655 / 585 / 605 ms**. Каталогийнх шиг warm response сайжрал харагдсангүй.
- Нэг `/product/[id]`: **156 / 152 / 153 ms**. Энэ нэг бүтээгдэхүүний хэмжилтийг бүх каталогт хамааруулж болохгүй.
- `/login`: **13 / 4 / 4 ms**; `/planner`: **7 / 3 / 4 ms**; `/kitchen`: **7 / 3 / 3 ms**. Эдгээр хурдан HTML нь hydration/3D loading хурдан гэсэн үг биш.
- `/api/payments/methods`: HTTP 200 боловч **QPay, SocialPay, bank_transfer бүгд `available: false`**.
- `/api/kitchen/export/skp`: HTTP 200, **`available: false`**.

Build-ийн First Load JS: `/` 123 kB; `/product/[id]` 132 kB; `/login`, `/register` 385 kB; `/checkout` 388 kB; `/account` 407 kB; `/merchant` 427 kB; `/kitchen` 428 kB; `/planner` 440 kB; `/admin` 441 kB. Эдгээр нь Next build-ийн тооцоо; бодит browser transfer, нийт lazy chunks эсвэл GLB хэмжээтэй адилгүй.

## 4. P0 — release хааж буй болон эхний 10 хоногт заавал шийдэх ажил

### P0-01. Бодит төлбөрийн арга ажиллуулах

**Баримт:** локал `.env.local`-д QPay base URL байгаа ч эрх дутуу; SocialPay болон банкны 3 утга мөн дутуу. API бүх аргыг unavailable гэж буцаалаа. Production env шалгалт унаж байна.

**Файлууд:** [.env.example](.env.example), [providers.ts](src/lib/payments/providers.ts), [methods/route.ts](src/app/api/payments/methods/route.ts), [payment route](src/app/api/orders/[id]/payment/route.ts), [callback route](src/app/api/payments/callback/[method]/[id]/route.ts), [order page](src/app/(shop)/orders/[id]/page.tsx), [validate-env.mjs](scripts/validate-env.mjs).

**Ажил:** hosting орчинд `APP_URL`, сонгосон бодит provider-ийн эрх оруулах. QPay эрх хүлээгдэх бол банкны шилжүүлэг + одоо байгаа админы данс тулгалтын ажиллагааг release хувилбар болгох. Checkout-д идэвхгүй аргыг зөв харуулах; хоосон аргын үед хэрэглэгчийг мухардсан захиалга руу оруулахгүй байх.

**Дууссан шалгуур:** бодит орчинд төлбөр орж, яг нэг захиалга paid болно; давхар callback, буруу дүн, цуцалсны дараах late payment, admin bank confirmation ажиллана. Mock төлбөрөөр production-д paid болгохыг бодит төлбөрийн баталгаажуулалт гэж тооцохгүй.

**То estimate:** 6–10 инженерийн цаг + provider эрхийн гадаад хүлээлт. Эзэн: бизнес/дансны эрхийг хариуцагч + хөгжүүлэгч. Production secret-ийг чатад хуулж өгөх шаардлагагүй.

### P0-02. Каталогийн өгөгдөл болон эвдэрсэн зургийг цэгцлэх

**Баримт:** public API-аар 32 бараа байна. **7 барааны `image` нь `/public/image.png`; 10 барааны `basePrice` нь 100₮-өөс ихгүй**. Эдгээр тоо хоорондоо давхцаж болно. Бага үнэ нь дангаараа устгах үндэслэл биш; нэг бүрчлэн шалгах candidate.

**Файлууд:** [catalogServer.ts](src/lib/catalogServer.ts), [catalogValidation.ts](src/lib/catalogValidation.ts), [AdminProducts.tsx](src/components/AdminProducts.tsx), [MerchantDashboard.tsx](src/components/MerchantDashboard.tsx), [ProductCard.tsx](src/components/ProductCard.tsx), [public/image.png](public/image.png).

**Ажил:** `catalogServer.ts`-ийн буруу fallback замыг засах; зураггүй бүтээгдэхүүний зөв empty state хийх. Нэр, үнэ, үлдэгдэл, өнгө/материал, хэмжээ, merchant холбоос, GLB scale, cover image-ийг бүх release бараанд тулгах. Туршилтын барааг review хийж archive болгох санал гаргах; шууд бөөнөөр delete хийхгүй.

**Дууссан шалгуур:** public catalog-д шалгаагүй тест бараа, эвдэрсэн зураг, худал stock/үнэ үлдэхгүй; барааг зассаны дараа forced refresh болон checkout шинэ үнэ/үлдэгдлийг авна.

**То estimate:** 3–5 инженерийн цаг + 3–5 цаг бизнесийн контент шалгалт.

### P0-03. Бодит бизнесийн контент ба үйл ажиллагааны нөхцөл

**Баримт:** `/about` нь `STORE_LOCATIONS` статик хаяг, утас, Токио салбар, “7 жил”, “62мянга”, “98%” зэрэг кодод бичсэн тоонуудыг харуулж байна. Эдгээрийн бодит нотолгоо repository-д тогтоогдоогүй. `CONTACT_EMAIL`, `CONTACT_PHONE` локал тохиргоонд хоосон; утас нь кодын fallback ашиглана.

**Файлууд:** [about/page.tsx](src/app/(shop)/about/page.tsx), [reviews.ts](src/lib/reviews.ts), [siteContact.ts](src/lib/siteContact.ts), [Footer.tsx](src/components/Footer.tsx), [checkout/page.tsx](src/app/(shop)/checkout/page.tsx), шинээр нэмэх хүргэлт/буцаалт/үйлчилгээний нөхцөл, хувийн мэдээллийн тайлбарын хуудсууд.

**Ажил:** эзэмшигчээр бодит нэр, хаяг, утас, имэйл, баталгаа, хүргэлтийн хамрах бүс, цуцлалт/буцаалт, хувийн мэдээллийн хэрэглээг баталгаажуулж сайт дээр холбоостой болгох. Батлагдаагүй статистик/салбарыг засах. `/about` build time-д үүсдэг тул env/контент өөрчилсний дараа rebuild хийх.

**То estimate:** 3–5 инженерийн цаг; контентын эзний оролцоо эхний 1–2 хоногт хэрэгтэй.

### P0-04. Нэвтрэх урсгал, email confirmation, нууц үг сэргээх

**Баримт:** login/register бий. `src/app` дотор forgot/reset password болон auth callback-д зориулсан route олдсонгүй; `resetPasswordForEmail`/password update урсгал source-д олдсонгүй. Supabase dashboard-ийн бодит redirect/SMTP тохиргоог энэ аудитад шалгаагүй.

**Файлууд:** [auth.ts](src/store/auth.ts), [login/page.tsx](src/app/(shop)/login/page.tsx), [register/page.tsx](src/app/(shop)/register/page.tsx), [authRedirect.ts](src/lib/authRedirect.ts), [authErrors.ts](src/lib/authErrors.ts), шинээр нэмэх password recovery болон шаардлагатай confirmation handling.

**Ажил:** нууц үг сэргээх, email баталгаажуулалт, expired link, session дуусах, sign out/sign in-ийг бүтэн турших. Домэйн redirect allowlist болон email sender-ийг hosting орчинтой тохируулах.

**Дууссан шалгуур:** бодит имэйлээр бүртгүүлж, баталгаажуулж, нууц үгээ сэргээж нэвтэрнэ. Customer/merchant/admin эрх ба нэг хэрэглэгчийн сагс/загвар нөгөөд харагдахгүй.

**То estimate:** 4–6 инженерийн цаг + email delivery тохиргоо.

### P0-05. Production DB, migration, worker, deployment-ийг сэргээгдэх болгох

**Баримт:** олон SQL migration, commerce-ийн PGlite интеграцийн тест байна. Энэ нь hosting DB-д бүгд зөв applied гэсэн баталгаа биш. `shineCategoryNemeh.sql`, `update_h_d_mm.sql` нь version timestamp-гүй; давтан apply хийхэд constraint болон шүүгээний хэмжээний бодлоготой зөрөх эрсдэлтэй. Model processing нь тусдаа `models:worker` script-тэй; веб серверийг асаах нь worker-ийг автоматаар асаахгүй.

**Файлууд:** [supabase/migrations](supabase/migrations), [shineCategoryNemeh.sql](supabase/migrations/shineCategoryNemeh.sql), [update_h_d_mm.sql](supabase/migrations/update_h_d_mm.sql), [worker.mjs](scripts/models/worker.mjs), [pipeline.mjs](scripts/models/pipeline.mjs), [README.md](README.md), [checkout-setup.md](docs/checkout-setup.md), [package.json](package.json), [ci.yml](.github/workflows/ci.yml), [validate-env.mjs](scripts/validate-env.mjs).

**Ажил:** live applied migration жагсаалтыг нягтлах; clean staging DB baseline/replay хийх; backup/restore шалгах. Version-гүй SQL-ийн applied эсэхийг тогтоогоод шинэ versioned migration эсвэл operator script болгон зохион байгуулах; аль хэдийн applied migration-ийг зүгээр rename/edit хийхгүй. Background model worker-ийн runtime/dependencies, restart, stalled job recovery, storage access, R2/Cloudinary upload, CORS, decoder serving-ийг deploy төлөвлөгөөнд оруулах.

**Дууссан шалгуур:** staging-д шинээр deploy хийж бүртгэл → бүтээгдэхүүн upload/processing → publish → order урсгал явна; нэг өмнөх build рүү буцаах заавар, DB/storage backup бий.

**То estimate:** 5–8 инженерийн цаг, hosting сонголт/эрхээс хамаарна.

### P0-06. Browser болон бодит төхөөрөмжийн бүтэн шалгалт

**Файлууд:** [tests](tests), [kitchen-visual.cjs](scripts/verify/kitchen-visual.cjs), [ProductAR.tsx](src/components/ProductAR.tsx), [RoomPlanner.tsx](src/components/RoomPlanner.tsx), [ModularKitchenPlanner.tsx](src/components/ModularKitchenPlanner.tsx), [CommerceOrderActions.tsx](src/components/CommerceOrderActions.tsx), шинэ E2E smoke test.

**Ажил:** desktop Chrome, Android Chrome, iPhone Safari дээр checkout, AR unsupported state, touch drag, save/load, undo/redo, export, refresh/relogin, WebGL failure, удаан сүлжээ, API алдааны recovery шалгах. Test GET-ийн HTTP 200-г энэ шалгалтын оронд ашиглахгүй.

**Дууссан шалгуур:** гол урсгалын test matrix болон баримт хадгалсан; мөнгө/эрх/хадгалалт алдах unresolved P0 байхгүй.

**То estimate:** 6–8 цаг анхны шалгалт. Олдсон засварт нөөц цаг нэмэгдэнэ.

## 5. Runtime удаашруулж байгаа болон оновчлох файлууд

### R-01. Auth хуудсуудын 385 kB First Load JS — хамгийн түрүүнд

**Файлууд:** [auth.ts](src/store/auth.ts), [designs.ts](src/store/designs.ts), [kitchens.ts](src/store/kitchens.ts), [roomPlacement.ts](src/three/roomPlacement.ts), [collision.ts](src/three/collision.ts), [furnitureFloorBand.ts](src/three/furnitureFloorBand.ts), [AuthBootstrap.tsx](src/components/AuthBootstrap.tsx).

Auth → designs → roomPlacement/collision → furnitureFloorBand → Three.js гэсэн source dependency зам бий. Auth → kitchens → kitchenAssembly мөн planner тооцооллыг холбоно. Login client reference manifest том `b536a0f1-*.js` chunk-ийг зааж байгаа; тухайн chunk-д WebGL renderer-ийн код байна. Энэ dependency холбоо том bundle-ийн бодит candidate; хувь тус бүрийн нөлөөг салгасан build-ээр батлах хэрэгтэй.

**Ажил:** data ownership/reset-ийг planner engine-ээс хөнгөн салгах; geometry тооцоолол, WebGL floor-band cache-ийг зөв boundary-д байрлуулах; lazy loading хийхдээ хуучин хэрэглэгчийн state үлдэх race condition үүсгэхгүй.

**Дууссан шалгуур:** login/register/checkout-ийн эхний chunk-д WebGL engine орохгүй; өмнөх build-ээс bundle буурсан; owner isolation тестүүд давсан. 4–6 цаг.

### R-02. `/kitchens` дахин хүсэхэд 585–655 ms

**Файлууд:** [kitchenMarketplaceServer.ts](src/lib/kitchenMarketplaceServer.ts), [kitchens/page.tsx](src/app/(shop)/kitchens/page.tsx), [kitchens detail](src/app/(shop)/kitchens/[slug]/page.tsx), [publicCatalog.ts](src/lib/publicCatalog.ts), [catalogCache.ts](src/lib/catalogCache.ts).

Published list нь design → version/store → merchant profile → media гэсэн query үе шаттай. Public kitchen reads одоогийн catalog snapshot-тай адил cache ашиглахгүй. Хэмжсэн удаашрал бодит; query тус бүрийн хувь хэмжээг instrument хийгээгүй.

**Ажил:** public published snapshot-д богино TTL/in-flight coalescing эсвэл зөв invalidation хийх; published/active/merchant эрхийн шалгалтыг хадгалах; admin/private review history-г public cache-д оруулахгүй. Index/query timing-ийг шалгах.

**Дууссан шалгуур:** warm list нэг бүрд ижил DB chain давтахгүй; unpublish/merchant deactivate зөв хугацаанд public-аас алга болно. 3–5 цаг.

### R-03. GLB delivery-ийн серверийн proxy, урт upstream хугацаа

**Файлууд:** [model files route](src/app/api/models/files/[id]/[...filename]/route.ts), [r2Models.ts](src/lib/r2Models.ts), [modelAssets.ts](src/lib/modelAssets.ts), [modelLoader.ts](src/three/modelLoader.ts), [GLBFurnitureMesh.tsx](src/three/GLBFurnitureMesh.tsx).

R2 cold request нь DB lookup → signed download URL → Node proxy stream гэсэн замтай, upstream timeout 120 секунд. Immutable delivery cache байгаа нь сайн; CDN үнэхээр cache хийж байгаа эсэх энэ аудитад хэмжигдээгүй. Public preview нь 5 минутын cache. Урт timeout нь дангаараа latency-ийн шалтгаан биш, харин асуудал гарвал удаан хүлээлгэх дээд хязгаар.

**Ажил:** representative GLB-ийн хэмжээ, preview/high ready time, CDN hit/miss, DB lookup, stream bytes, concurrent load хэмжих; шаардлагатай бол approved asset delivery/CDN замыг сайжруулах. Public хийх эрхийн шалгалт, private original/export хамгаалалтыг сулруулахгүй. Preview pipeline/backfill ажиллаж байгааг шалгах.

**Дууссан шалгуур:** бодит release model-уудын p50/p95 ready time ба хэмжээний баримт, алдааны timeout/retry ойлгомжтой. 2–4 цаг хэмжилт/энгийн засвар; том asset дахин боловсруулах хугацаа тусдаа.

### R-04. Prefetch болон loader queue-ийн давхцал

**Файлууд:** [modelPrefetch.ts](src/lib/modelPrefetch.ts), [ProductCustomizer.tsx](src/components/ProductCustomizer.tsx), [RoomPlanner.tsx](src/components/RoomPlanner.tsx), [KitchenModelLibrary.tsx](src/features/kitchen-planner/components/KitchenModelLibrary.tsx), [modelLoader.ts](src/three/modelLoader.ts).

Prefetch нь бүх body-г `arrayBuffer()` болгож уншина; дараа GLTFLoader тусдаа хүсэлт хийнэ. HTTP cache duplicate network-ийг бууруулж болно. Нэгэн зэрэг prefetch 2, loader 3 гэсэн тусдаа queue бий. Prefetched map-д success entry eviction байхгүй. Энэ нь олон model үзэх үед нэмэлт CPU/санах ой/сүлжээний candidate; бодит давхар bytes/heap leak хараахан хэмжээгүй.

**Ажил:** network trace дээр duplicate download болон queue contention-ийг батлах; шаардлагатай бол нэг shared loader/cache, hover dwell, AbortController, bounded prefetch bookkeeping хэрэглэх. 1–2 цаг эхний хэмжилт/засвар.

### R-05. GPU байнгын render ба AR polling

**Файлууд:** [ProductViewer.tsx](src/three/ProductViewer.tsx), [canvasPerformance.ts](src/three/canvasPerformance.ts), [ProductAR.tsx](src/components/ProductAR.tsx), [modelViewer.ts](src/lib/modelViewer.ts), [MerchantNotifications.tsx](src/components/MerchantNotifications.tsx).

Desktop product autoRotate нь `frameloop="always"`; idle үед GPU ажиллана. Mobile/reduced motion-д чанар бууруулах код аль хэдийн бий. AR modal нээлттэй үед capability polling 300 ms; readiness үед scene traversal 100 ms; close дээр cleanup бий. Merchant notifications нь 60 секунд тутам polling + focus refresh; overlap/hidden-tab pause хамгаалалт харагдсангүй.

**Ажил:** hidden/offscreen үед render/polling pause; AR readiness-ийг event/bounded polling болгох; notifications-ийн overlap хамгаалалт. GPU/FPS хэмжсэний дараа шийдэх. 1–2 цаг.

### R-06. CSS болон том component-ууд — runtime ба засварын хугацааг тусад нь

Shop layout нь бүх shop route-д storefront, shop-the-look, product-experience, directory-search CSS оруулдаг. Root нь `globals.css` 1,896 мөртэй. `/login` ч product/inspiration CSS замд орно. Planner-ууд хэд хэдэн давхар CSS импорттой.

**Файлууд:** [shop layout](src/app/(shop)/layout.tsx), [globals.css](src/app/globals.css), [storefront.css](src/app/(shop)/storefront.css), [product-experience.css](src/app/(shop)/product-experience.css), [RoomPlanner.tsx](src/components/RoomPlanner.tsx), [ModularKitchenPlanner.tsx](src/components/ModularKitchenPlanner.tsx), [planner feature CSS](src/features/planner/components).

**Ажил:** shared token/base style-ийг route-specific CSS-ээс салгах; dead selector/import-ийг usage-аар батлах; modal/report/history зэрэг ховор хэрэглэх хэсгийг lazy load хийх. Мөр олон байх нь өөрөө runtime удаан гэдгийг батлахгүй. 2–3 цаг зөвхөн аюул багатай салгалт; бүрэн rewrite-ийг release-ийн өмнө хийхгүй.

**Runtime-ийн эхний багц:** R-01, R-02, дараа нь R-03-ийн хэмжилт. Нүүр/catalog-ийн аль хэдийн хурдан cache-ийг дахин бүтээх нь эхний ажил биш.

## 6. Цэгцлэх файлын жагсаалт

### Эхний 10 хоногт

1. `src/lib/catalogServer.ts` — `/public/image.png` fallback, optional schema compatibility-г live migrations-тай тулгах.
2. `src/store/auth.ts`, `src/store/designs.ts`, `src/store/kitchens.ts`, `src/three/furnitureFloorBand.ts` — ownership ба planner dependency салгах; auth bundle.
3. `src/lib/kitchenMarketplaceServer.ts` — public query/cache болон private admin history boundary; админы 1000 design/5000 history хэмжээний limit-ийг pagination хэрэгцээтэй тулгах.
4. `src/app/(shop)/about/page.tsx`, `src/lib/reviews.ts`, `src/lib/siteContact.ts` — батлагдаагүй бизнесийн мэдээлэл; contact env.
5. `scripts/validate-env.mjs` — production шалгалт бүх payment group бүрэн хоосон үед “none” гэж valid болох боломжтой. Release нь дор хаяж нэг configured арга шаарддаг гэдгийг тусдаа commerce gate болгох. Supabase client-ийн legacy key fallback-тай validator шаардлагыг тохируулах.
6. `.github/workflows/ci.yml`, `package.json` — одоогийн CI tracked боловч `styles:check` алхам алга; `verify` production env check ашиглахгүй. Production feature smoke ба release gate нэмэх. CI-ийн placeholder env нь бодит provider бэлэн гэдгийг батлахгүй.
7. `.gitignore`, `docs/checkout-setup.md`, `README.md` — README payment setup руу линкддэг ч checkout setup одоогоор ignored, `git ls-files`-д алга. Docs allowlist-д оруулж version control-д авах. `.github/` ignored ч одоогийн tracked CI хэвээр; шинээр нэмэх workflow-ийг алдахгүй байх бодлогыг засах.
8. `supabase/migrations/shineCategoryNemeh.sql`, `supabase/migrations/update_h_d_mm.sql` — applied эсэхийг нягталж versioned migration/operator script-д зөв байрлуулах.
9. `src/app/(shop)/layout.tsx` болон shop CSS — route-specific imports, давхар style override.
10. `src/components/RoomPlanner.tsx` (2,034 мөр), `ModularKitchenPlanner.tsx` (2,131 мөр) — UI panel, save/export, catalog selection зэрэг салгах боломжтой хэсгийн зураглал; зөвхөн хэрэгтэй хязгаарлагдмал extraction.
11. `src/components/MerchantDashboard.tsx` (1,516), `AdminProducts.tsx` (1,421), `src/app/(admin)/admin/page.tsx` (1,406), `MerchantKitchenDesigns.tsx` (1,100) — upload/product form/panel-уудын хамаарлыг салгах candidate; бүх файлыг 10 хоногт rewrite хийх зорилго тавихгүй.
12. `PROJECT_AUDIT_AND_TODO.md`, `docs/catalog-performance.md`, `docs/model-pipeline.md` — одоогийн код/тестийн тоо, preview pipeline, shipping, feature төлөвтэй шинэчлэх. Өмнөх зөв санааг хадгалж, хуучирсан дүгнэлтийг засах.
13. `tsconfig.json` — `.next-dashboard-reference-build/types/**/*.ts` зэрэг хуучин build-specific include-ийг шаардлагатай эсэхээр шалгах. Production build бүрийн түр dist path source-д үлдэхээс сэргийлэх.

### Publish-д ойрхон гар хүрэх шаардлагагүй, дараа нь архивлах candidate

- Root-ийн `admin-preview.html`, `dashboard-redesign.html`, `multi-room-planner-preview.html`, `planner-sidebar-ideas.html`, `planner-sidebar-preview.html`, `preview.html`, `product-card-preview.html` — Next runtime source биш; дизайны reference болгон `docs/prototypes/` зэрэгт шилжүүлэх санал. Link/test хэрэглээг шалгасны дараа move хийх.
- `preview_design.jpg`, root/public дахь `multi_room_snap.jpg` — reference эсвэл бодит asset эсэх, checksum/usage шалгаад duplicate-ийг цэгцлэх.
- `PLANNERS-PACK-README.txt`, `PLANNERS-PACK-MANIFEST.sha256`, `UPDATE-README.txt`, `convert-glb-to-objects.js` — pack/history ба active tool-ийг ялгах; scripts/docs руу зохион байгуулах.
- `.next/`, `.next-shop-look-build/`, `.next-release-audit/`, `tsconfig.tsbuildinfo` — generated/cache. Disk/build audit-д хамаатай; сайтад удаашралын шууд шалтгаан гэж тооцохгүй. Ажиллаж буй dev server-ийн `.next`-ийг цэвэрлэхгүй.
- `uploads/`, `model-work/`, `patches/`, `.tools/` — ignored local artifacts/tools. Source asset эсвэл хэрэгтэй tool байж болох тул нөөц/usage шалгалтгүй устгахгүй.
- `src/lib/supabase/database.types.ts` (2,281 мөр) — generated schema, том гэсэн шалтгаанаар гараар задлахгүй; schema өөрчлөгдвөл regenerate.
- `node_modules/`, `package-lock.json` — dependency ба reproducibility-д хэрэгтэй. Lockfile-ийг “цэвэрлэх” гэж устгахгүй.
- `public/decoders/` — predev/prebuild-ээр үүсдэг боловч compressed GLB runtime-д зайлшгүй. Dead asset гэж устгахгүй.

## 7. Дутуу боловч scope-оос хамаарч release-ийн дараа хийж болох ажил

- **StorePay/Pocket:** `ProductInstallments.tsx` бодит BNPL биш, “Жишиг тооцоо”, “хараахан холбогдоогүй” гэж зөв тайлбарласан. 2 provider-ийг зэрэг холбох нь гадаад эрх/API verification шаарддаг. Launch-д заавал BNPL амласан бол P0 болгон ахиулж бусад шинэ feature-ийн хугацааг хасна.
- **Product reviews:** `src/lib/reviews.ts`-д mock `REVIEWS` байгаа ч одоогийн source-д импортлож render хийж буй хэрэглээ олдсонгүй. `/about` нь тус файлын `STORE_LOCATIONS`-ийг ашигладаг. Product review submit endpoint/schema урсгал олдоогүй. Mock reviews public-д харагдаж байна гэж таамаглахгүй. Бодит review/moderation шаардлагатай бол тусдаа feature.
- **SKP converter:** config хоосон, API unavailable. `KitchenExportButtons.tsx` availability шалгадаг тул өмнөх аудитын “дарсан бүрд 503” тайлбар нь UI-ийн өнөөгийн байдалтай бүрэн нийцэхгүй. Шууд SKP release requirement бол converter байршуулж бодит import/хэмжээ/материал шалгана; бусад тохиолдолд GLB export болон unavailable тайлбар release scope байж болно.
- **SMS/email order notification:** in-app merchant notification бий; transactional order email/SMS implementation энэ аудитын source хайлтад тогтоогдоогүй. “Захиалга байхгүй” биш, гадаад мэдэгдэл дутуу. Бизнесийн өдөр тутмын admin reconciliation-г эхлээд ажиллуулах; нэг email суваг нэмж болно. Олон SMS provider-ийг зэрэг эхлүүлэхгүй.
- **Бүсчилсэн хүргэлт:** structured district/region pricing, courier tracking интеграц олдсонгүй. Shipping одоо 1,500,000₮ босго, 49,000₮ стандарт үнэ. Үйлчлэх бүс/үнийг баталгаажуулах нь P0; олон бүсийн автомат тариф/курьер интеграц дараагийн feature байж болно.
- **AI render:** админы generation route бодитоор бий, cost approval ба claim/complete workflow-той; зөвхөн draft код гэж нэрлэх нь буруу. Request дотор урт external generation хийдэг (`maxDuration=300`, generation timeout 180 s). Hosting duration болон stalled job recovery-г шалгах; customer real-time generation нь өөр scope. Энэ аудитад төлбөртэй AI API дуудаагүй, model availability батлаагүй.
- **SEO:** product title metadata байгаа. Custom sitemap/robots/OG/canonical/product structured data олдсонгүй. Public route-ийн metadata, sitemap/robots болон product share preview-г 1–2 цагийн эхний багцаар хийх; нууц account/order/admin хуудсыг индексжүүлэхгүй. Энэ нь SEO оновчлолын ажил, төлбөрийн blocker-оос дараа.
- **Server-side search/pagination:** латин/монгол alias аль хэдийн бий. Одоогийн 32 бараанд full-text engine нэвтрүүлэх нь эхний bottleneck биш. Catalog бүх бараагаа 500-row page-уудаар уншиж клиент рүү өгдөг тул хэдэн мянгад хүрвэл API pagination/projection, server search хийх.
- **Cloud sync:** cart/wishlist/room design нь per-user browser storage; kitchen designs backend-д хадгалагдана. Room design-ийн cross-device sync амласан бол backend save/load тусдаа ажлыг P0 болгож scope-д оруулна.

## 8. Эхний 10 хоногийн ажлын дараалал

**1 дэх өдөр — blocker ба scope.** P0-01 provider/domain/hosting эрхийг эхлүүлэх. Яг ямар payment, хүргэлтийн бүс, SKP/BNPL/AI release requirement болохыг тогтоох. Каталогийн 32 барааны review жагсаалт; live migration inventory. Өдрийн үр дүн: dependency owner, access, нэг мөр release scope.

**2 дахь өдөр — тохиргоо ба өгөгдөл.** Нэг бодит төлбөрийн аргын тохиргоо; fallback image, тест бараа archive review; батлагдсан contact/about/нөхцөл. Credentials ирээгүй бол хугацааны эрсдэлийг энэ өдөр ил гаргах.

**3 дахь өдөр — payment ба commerce E2E.** Sandbox/provider test, bank reconciliation, order total/stock, duplicate callback, late payment, cancellation/refund record. Одоо байгаа ажиллагааг засах/баталгаажуулах.

**4 дэх өдөр — auth.** Email confirmation/recovery, redirect, logout/login ownership, эрхийн сөрөг шалгалт.

**5 дахь өдөр — DB/deployment.** Staging baseline/replay, storage/worker/decoder smoke, backup/restore, rollback заавар. Шинэ орчинд бүтээгдэхүүнээс захиалга хүртэл ажиллуулах.

**6 дахь өдөр — том bundle.** R-01 auth/store boundary, R-06 аюул багатай lazy split. Bundle өмнө/дараа, owner isolation regression.

**7 дахь өдөр — public kitchen болон asset runtime.** R-02 cache/query; R-03 representative GLB profile; R-04/R-05-ийг хэмжилтээр шаардлагатай бол засах. Төсөв үлдвэл SEO эхний багц.

**8 дахь өдөр — planner ба mobile.** Room/kitchen хэмжээ, save/load, touch, undo/redo, export, AR, алдааны recovery. Browser performance ба memory baseline.

**9 дэх өдөр — багц шалгалт, засвар.** Customer/merchant/admin test matrix; нэгж/DB тест, lint/typecheck/styles/build, production env, monitoring; гол урсгалын E2E. Critical defect засах.

**10 дахь өдөр — release candidate.** Бүх P0 шалгуурын баримтыг хаах; scope freeze; version/tag, deployment/rollback checklist, production settings verification. Дуусаагүй P0 байгаа бол “бүрэн болсон” гэж тэмдэглэхгүй.

**11–12 дахь өдөр:** production-той төстэй орчинд бизнесийн хэрэглэгчийн acceptance, Android/iPhone, бодит provider validation; blocker/regression засвар.

**13 дахь өдөр:** зөвхөн засвар ба дахин баталгаажуулалт; backup/restore, domain/HTTPS, operational rehearsal. Шинэ том feature эхлүүлэхгүй.

**14 дахь өдөр:** release gate-ийг дахин шалгаад publish; payment/order/error monitoring, rollback хариуцагч бэлэн байна.

Энэ нь дарааллын хуваарилалт болохоос өдөр бүр багтах баталгаа биш. P0 эхний багц ойролцоогоор **27–42 инженерийн цаг**, runtime эхний багц **9–15 цаг**, контент review **3–5 цаг**, regression/SEO/CI/docs/fix reserve **12–20 цаг**: нийлээд **51–82 цаг**, provider/контент/hosting хүлээлт ороогүй. Нэг хөгжүүлэгч өдөрт 6 төвлөрсөн цагтай бол 10 хоногт 60 цаг: доод хүрээ багтана, дээд хүрээ багтахгүй. Credentials удах, mobile/model том асуудал, full SKP/BNPL нэмэх үед нэмэлт хүн эсвэл scope-ийн тодорхой өөрчлөлт хэрэгтэй.

## 9. Publish хийхийн өмнөх хаалтын шалгуур

- Production env check болон styles/lint/typecheck/test/build бүгд pass.
- Дор хаяж нэг бодит payment; callback/reconciliation, late payment, cancellation/refund policy баталгаажсан.
- Release бараа бүрийн зураг, үнэ, stock, хэмжээ, merchant шалгагдсан.
- Customer/merchant/admin эрх, өөр хэрэглэгчийн өгөгдөл тусгаарлалт баталгаажсан.
- Email confirmation/password recovery болон session error recovery ажилласан.
- Room/kitchen save/load/export болон mobile/AR support state бодит төхөөрөмж дээр баталгаажсан.
- Clean deploy, DB migration record, model worker/storage smoke, backup/restore, rollback заавар бий.
- Бодит бизнесийн мэдээлэл/нөхцөл/contact зөв, dead link болон misleading promise байхгүй.
- Monitoring ба өдөр тутмын order/payment reconciliation эзэн тодорхой.
- Нээлттэй P0 алдаа **0**; үлдсэн P1 бүр эзэн/хугацаа/хэрэглэгчийн нөлөөтэй бүртгэгдсэн.

## 10. Өмнөх аудитаас засаж ойлгох зүйл

`PROJECT_AUDIT_AND_TODO.md`-ийг бүхэлд нь launch backlog гэж хуулж болохгүй. Тест одоо 513; CSS formatting одоо pass; латин `buidan` alias бий; shipping threshold 100,000₮ биш 1,500,000₮; merchant fulfillment/cancellation/manual refund record хэрэгжсэн; public mock review rendering олдсонгүй; product installments нь интерактив жишиг тооцоолуур; SKP unavailable UI handling бий; admin AI generation implementation бий.

Эхний шийдэх багц: **payment + каталог/бизнесийн контент + auth recovery + production DB/deploy**, дараа нь **auth bundle + public kitchen latency**, эцэст нь **device E2E + release gate**. Root-ийн preview файл, generated cache цэвэрлэх нь эдгээр blocker-ийг орлохгүй.
