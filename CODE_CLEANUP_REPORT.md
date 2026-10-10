# Кодын цэгцлэл ба runtime

2026-10-09. Одоогийн кодыг засварлахад ойлгомжтой болгохын зэрэгцээ browser-ийн эхний JavaScript ачааллыг бууруулав.

## Component-уудын шинэ байрлал

| Entry файл | Өмнөх мөр | Одоогийн мөр | Шилжүүлсэн хэсэг |
|---|---:|---:|---|
| `src/components/MerchantDashboard.tsx` | 1516 | 234 | `src/features/merchant/` |
| `src/components/AdminProducts.tsx` | 1421 | 26 | `src/features/admin-products/` |
| `src/app/(admin)/admin/page.tsx` | 1406 | 153 | `src/features/admin-models/` |

Entry файлууд эрх шалгах, navigation болон component-уудыг холбох үүрэгтэй. Тусдаа function-уудыг бүтнээр нь шилжүүлсэн; hook-ийн дараалал, component identity, owner-ийн key, draft scope, API request болон handler-ийн логик хадгалагдсан.

```text
src/features/merchant/
  MerchantOverview.tsx       — дэлгүүрийн ерөнхий мэдээлэл
  StoreProfile.tsx           — дэлгүүрийн мэдээлэл засах
  MerchantProducts.tsx       — бүтээгдэхүүний жагсаалт
  MerchantProductEditor.tsx  — бүтээгдэхүүн засах
  merchantApi.ts             — owner шалгалт, request, шинэ бүтээгдэхүүний defaults

src/features/admin-products/
  ProductList.tsx            — хайлт, шүүлтүүр, pagination
  ProductEditor.tsx          — бүтээгдэхүүн болон GLB засах

src/features/admin-models/
  ModelsTab.tsx              — upload, processing, export, archive
  modelTypes.ts              — model-ийн төрлүүд болон form-ийн сонголтууд
```

Том planner/controller файлууд болон геометрийн тооцооллуудын нягт бичигдсэн кодыг олон мөрт, тогтмол indentation-тэй болгосон:

- `RoomPlanner.tsx`, `ModularKitchenPlanner.tsx`
- `MerchantKitchenDesigns.tsx`, `RoomEnvironmentPanel.tsx`, `KitchenOptionsPanel.tsx`
- `kitchenPlacement.ts`, `kitchenAssembly.ts`, `modelPlacement.ts`
- `RoomStructure.tsx`, `roomPlacement.ts`, `collision.ts`, `furnitureFloorBand.ts`

Хоёр planner-ийн үлдсэн controller урт хэвээр. Тэдгээрийн холбоотой state, history болон selection handler-уудыг мөрийн тоонд тааруулан механикаар таслах шаардлагагүй. Дараагийн UI өөрчлөлтөөр тусдаа үүрэгтэй panel-уудыг одоогийн feature хавтас руу гаргах нь тохиромжтой.

## CSS-ийг хаанаас хайх вэ

Өмнөх import-ын замууд хэвээр, entry CSS файлууд дараалалтай `@import` жагсаалт болов. Дөрвөн том stylesheet нийт 20 section файлд хуваагдсан.

| Entry | Section-уудын хавтас | Үүрэг |
|---|---|---|
| `(shop)/storefront.css` | `src/app/(shop)/styles/` | marketplace, homepage, category discovery, studio theme, commerce |
| `components/kitchen-planner.css` | `src/features/kitchen-planner/styles/` | editor base, suggestions, fullscreen, workspace, cabinet alternatives |
| `components/room-planner.css` | `src/features/room-planner/styles/` | editor base, structure inspector, workspace |
| `(admin)/admin/admin.css` | `src/app/(admin)/admin/styles/` | forms, shell, sidebar, header, analytics, orders, responsive/merchant styles |

Import-ын дараалал нь cascade-ийн дараалал. Ижил selector-ийн дараагийн override-ийг өмнөх section руу зөөж болохгүй. Энэ цэгцлэлээр selector, declaration, media query болон override-ийн дарааллыг өөрчлөөгүй. Эцсийн production build-ийн **12 CSS artifact өмнөх build-тэй byte түвшинд ижил**.

`scripts/styles/read.cjs` нь local import-уудыг дарааллаар нь дэлгэж шалгана. Style checker болон storefront-ийн тестүүд section файлууд дахь дүрмийг мөн шалгадаг; entry файлыг хоосон manifest болгосноор тестийн шалгалт алдагдахгүй.

## Runtime-д хийсэн бодит өөрчлөлт

Өмнөх eager import-ын зам:

```text
auth → designs → roomPlacement → collision → furnitureFloorBand → Three.js
```

Collision шалгалтад Three.js scene хэрэггүй; урьдчилан тооцсон footprint rectangle-ууд хэрэгтэй. Cache-ийг `src/lib/modelFloorBand.ts` руу шилжүүлж, collision энэ хөнгөн модулиас уншдаг болов. Scene-ийн triangle-уудаас footprint гаргах ажиллагаа `src/three/furnitureFloorBand.ts` дотор хэвээр.

Cache-ийн dimension key, 128 entry хязгаар, шинэчилсэн entry-ийн дараалал, high model-ийг preview-ээр солихгүй байх зан төлөв хадгалагдсан. Auth-ийн synchronous owner reset хэвээр.

Ижил төслийн өмнөх ба дараах production `next build`-ийн **First Load JS**:

| Route | Өмнө | Дараа |
|---|---:|---:|
| `/login`, `/register` | 385 kB | 213 kB |
| `/account` | 407 kB | 235 kB |
| `/checkout` | 388 kB | 216 kB |
| `/admin` | 441 kB | 269 kB |
| `/merchant` | 427 kB | 255 kB |
| `/kitchen` | 428 kB | 256 kB |
| `/planner` | 440 kB | 268 kB |
| `/` | 123 kB | 123 kB |
| `/product/[id]` | 132 kB | 132 kB |

Login-ийн эхний JavaScript ойролцоогоор 45% багассан. Энэ нь bundle хэмжээний хэмжилт; server runtime, browser LCP, хэрэглэгчийн интернэт дэх хугацааны миллисекундийг хэмжээгүй. Planner-ийн 3D scene нээгдэхэд хэрэгтэй Three.js дараа нь ачаалагдана.

## Том файлыг салгах эсэх

| Файлын төрөл | Runtime-д нөлөөлөх зүйл | Шийдвэр |
|---|---|---|
| Урт TSX component | Browser-д очих bundle, render болон тооцоолол | Үүргээр нь салгана. Static import хэвээр бол жижиг файл болгох нь дангаараа татах хэмжээг бууруулахгүй. |
| Optional editor/3D | Эхэнд хэрэггүй dependency eager ачаалагдах | Хамаарлыг салгах; шаардлагатай үед dynamic import ашиглах. |
| CSS | Нийт дүрэм, byte хэмжээ, selector болон layout ажил | Section-оор зохион байгуулна; cascade-ийг хадгална. Энэ өөрчлөлт CSS-ийн byte хэмжээг бууруулаагүй. |
| `database.types.ts` | Type-only хэрэглээ нь JavaScript-д арилна | Generated schema-г гараар таслахгүй. |
| Python/worker script | Server дээр бодитоор ажиллах ажиллагаа | Browser bundle-д орохгүй. Урт файлаас бус job-ийн ажиллагаа, RAM, CPU-гаас хугацаа хамаарна. |
| GLB, texture | Download, decode, GPU memory, triangle/draw call | Preview, LOD болон чанарын тохиргоогоор оптимизац хийнэ; source code цэгцлэх нь geometry compression-ийг засахгүй. |

Lazy loading-ийн тайлбар: [Next.js documentation](https://nextjs.org/docs/app/guides/lazy-loading).

## Баталгаажуулалт

- Бүх **517 тест passed**, failure/skip байхгүй.
- `npm run lint`, `npm run typecheck`, `npm run styles:check`, production build passed.
- 51 CSS файл syntax, selector, formatting болон local import шалгалтад тэнцсэн.
- Шилжүүлсэн 29 declaration-ийн normalized body өмнөхтэй ижил.
- Зөвхөн форматласан 10 том controller/math файлын normalized source өмнөхтэй ижил.
- Дөрвөн салгасан stylesheet-ийн дэлгэсэн CSS AST өмнөхтэй ижил; production CSS artifact-ууд byte түвшинд ижил.
- Auth-аас eager Three.js импорт эргэж үүсэхээс хамгаалах regression тест нэмсэн.
- Cache-ийн dimension isolation болон eviction-ийг шалгах тест нэмсэн; өмнөх leg/skirting/preview-priority тестүүд passed.

Prettier-ийг dev dependency болгож, `.prettierrc.json`, `.prettierignore` нэмэв. `npm run format:code` нь source TS/TSX-ийг форматлана; generated database schema-г алгасана. CSS-д өмнөх `npm run styles:format`-ийг ашиглана.
