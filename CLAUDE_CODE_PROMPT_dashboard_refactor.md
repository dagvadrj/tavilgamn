# Prompt: Merchant/Admin dashboard — debug, refactor, Excel-first UX, dark/light mode

Чи энэ Next.js төслийн (`tavilgamn`, Node 22, Next app router, Supabase, exceljs) Merchant болон Admin самбарыг шалгаж, debug хийж, refactor хийнэ. Эхлээд кодыг уншаад төлөвлөгөө гарга, дараа нь үе шаттайгаар хэрэгжүүл. UI copy-г монгол кирилл хэлээр бич.

## 0. Ажиллах дүрэм
- Эхлээд `git status` шалга, ажлыг тусдаа branch дээр хий (`chore/dashboard-refactor`). Үе шат бүрийн дараа тусдаа commit хий.
- Шалгаагүй зүйлийг "ажиллаж байна" гэж бүү хэл. Үе шат бүрийн дараа `npm run lint`, `npm run typecheck`, `npm test` ажиллуул. Төгсгөлд `npm run verify`.
- Шинэ dependency нэмэхээс өмнө одоо байгаа (`exceljs`, `@dnd-kit`, г.м.) зүйлээр шийдэж болох эсэхийг шалга.
- Хуучин кодын стиль (нэр, comment-ын нягтрал, idiom)-ийг дага. Нэг зүйлийг хийх дараа нь ашиглагдахгүй болсон кодыг устга.
- Root дахь `*.log`, `*-preview.html` файлуудыг бүү хөдөл, бүү устга (хэрэглэгчийн шийдвэр).

## 1. Эхлээд судал (код бичихээс өмнө)
Дараах газруудыг уншаад товч тайлан (хүснэгт) гарга: юу байна, юу эвдэрхий, юу давхардсан.
- Merchant: `src/app/(admin)/merchant/`, `src/features/merchant/` (`MerchantProducts.tsx`, `MerchantProductEditor.tsx`, `MerchantProductImport.tsx`, `StoreProfile.tsx` ...), `src/components/MerchantShell.tsx`
- Admin: `src/app/(admin)/admin/`, `src/components/Admin*.tsx`, `src/features/admin-products/ProductEditor.tsx`, `src/features/admin-models/`
- Excel: `src/lib/merchantExcel.ts`, `src/lib/merchantWorkbookStyle.ts`, `src/lib/merchantDocuments.ts`, `src/app/api/merchant/products/import|export/route.ts`
- Theme/CSS: `src/app/ui-theme.css`, `src/app/globals.css`, `src/app/(admin)/admin/admin-dark.css`, `admin.css`, `styles/*.css`, `src/app/(admin)/merchant/merchant.css`, `src/features/dashboard/*.css` (`admin-theme`, `merchant-theme`, `dashboard-glass`, `dashboard-v14`, `dashboard-reference`, `dashboard-usability`, `merchant-inputs`, `dashboard-forms`), `src/features/merchant/*.css`, `src/features/dashboard/useDashboardPreferences.ts`, `preferences.ts`
- Docs: `docs/merchant-operations.md`, `docs/merchant-stores.md`, `docs/role-permissions.md`, `docs/dashboard-drafts.md`, `PROJECT_AUDIT_AND_TODO.md`, `CODE_CLEANUP_REPORT.md`

Тайланд заавал агуулах:
1. Dashboard-ын CSS-ийн давхцал: ижил selector/token хэд хэдэн файлд тодорхойлогдсон эсэх, `!important`-ын тоо, ашиглагдаагүй class, файлуудын ачаалах дараалал (cascade), хуучин `v14`/`reference`/`glass` давхаргуудын аль нь одоо ч хэрэгтэй.
2. Theme-ийн механизм: light/dark яаж шийдэгддэг вэ (`data-theme`, `prefers-color-scheme`, class, localStorage), merchant ба admin хоёр ижил механизм ашигладаг эсэх, SSR дээр theme flash (FOUC) гарах эсэх.
3. Merchant ба admin хоёрын хооронд хуулбарлагдсан component/logic (бүтээгдэхүүний form, import, хүснэгт).

## 2. Debug & refactor (код)
- TypeScript алдаа, `any`, дараалан давтагдсан fetch/loading/error логик, race condition (давхар submit, хуучин response дарж бичих), ашиглагдахгүй export/prop, хэт том component (>400 мөр) зэргийг ол.
- Давхардсан логикийг `src/features/dashboard/` дахь нийтлэг hook/component болгон нэгтгэ (жишээ: `useMerchantResource` / `useAdminResource` хоорондын давхардал).
- API route-ууд (`/api/merchant/*`, `/api/admin/*`): эрхийн шалгалт (`docs/role-permissions.md`-тэй тулга), input validation, алдааны мессеж, merchant өөр merchant-ын өгөгдөлд хандаж чадахгүй эсэх. Дутуу зүйл олвол засаад жагсаалтад тэмдэглэ.
- Засахдаа зөвхөн баталгаатай алдааг засна. Таамаглалаар том рефакторлохгүй; эргэлзээтэй зүйлийг тайланд "асуулт" болгон үлдээ.

## 3. Excel-ээр бүтээгдэхүүн оруулах урсгал (гол зорилго)
Одоогийн асуудал: Merchant/Admin бүтээгдэхүүнийг гараар, олон input бөглөж нэмдэг; input бүрийн доор текст ба товчлуурууд дарагдсан, төвөгтэй. Зорилго: **Excel-ээр бөөнөөр оруулах нь үндсэн, хамгийн хялбар зам болно; гараар нэмэх нь хоёрдогч.**

Хийх:
1. **Excel template** татах товч (хоосон, жишээ мөртэй, dropdown-той: ангилал, нэгж, төлөв г.м. data validation; шаардлагатай баганыг тодруулсан; заавар sheet монголоор). `merchantExcel.ts` / `merchantWorkbookStyle.ts` дахь одоо байгаа кодыг дахин ашигла.
2. **Оруулах урсгал (3 алхам, нэг дэлгэц)**: ① Template татах → ② Файл чирж оруулах (drag & drop + товч) → ③ **Урьдчилан харах ба шалгах хүснэгт**: мөр бүрийн төлөв (зөв / анхааруулга / алдаатай), алдааны шалтгаан монголоор ("3-р мөр: үнэ тоо байх ёстой"), алдаатай мөрийг шууд хүснэгт дээр засах эсвэл алгасах, зөвхөн зөв мөрүүдийг баталгаажуулж хадгалах. Хадгалсны дараа хураангуй (хэд нэмэгдсэн/шинэчлэгдсэн/алгасагдсан) харуул, алдаатай мөрүүдийн Excel-ийг татах боломж өг.
3. **Давхцал/шинэчлэлт**: SKU (эсвэл одоо байгаа түлхүүр)-ээр ижил бүтээгдэхүүнийг шинэчлэх уу, алгасах уу гэдгийг нэг сонголтоор шийд. Файлын хэмжээ, мөрийн тоо, MIME төрлийг сервер талд шалга (`/api/merchant/products/import`). Том файлыг хэсэгчлэн боловсруул, UI гацаахгүй.
4. **Зураг ба 3D (GLB) холбох**: Excel-д зөвхөн текст/тоо; зураг, GLB-г бүтээгдэхүүн үүссэний дараа "зураг дутуу" жагсаалтаас массаар чирж оруулах хялбар зам өг (файлын нэр = SKU байвал автоматаар холбох санал).
5. **Гараар нэмэх (`MerchantProductEditor`)**: гол талбарууд (нэр, үнэ, ангилал, зураг) эхэнд; нэмэлт талбарууд "Дэлгэрэнгүй" accordion-д нуугд. Талбар бүрийн доорх урт тайлбар текст, олон товчлуурыг хас: тайлбарыг placeholder/нэг мөр hint, товчлуурыг нэг sticky action bar (Хадгалах / Ноорог / Болих) болго. Merchant "Нэг бүтээгдэхүүн нэмэх" ба "Excel-ээр оруулах" хоёр сонголтыг хуудасны дээд хэсэгт тодорхой харуул.
6. Admin талд ижил урсгалыг дахин ашигла (`admin-products/ProductEditor.tsx`): merchant сонгоод тэр merchant-ын нэрийн өмнөөс бөөнөөр оруулах боломжтой, нэг component хоёр талд ажиллана.
7. Хоосон төлөв (empty state): бүтээгдэхүүнгүй merchant-д "Excel template татаж эхлэх" гэсэн тод CTA.
8. Туршилт: import-ын parse/validate логикт unit test (`tests/*.test.cjs` загварыг дага): зөв файл, хоосон мөр, буруу төрөл, давхар SKU, том файл, буруу баганын нэр.

## 4. UI/UX шинэчлэл
- Merchant/Admin хоёр нэг design language: ижил spacing, radius, товчлуурын шатлал (primary / secondary / ghost / danger), ижил form control, ижил table.
- Хэрэглэгч эхний харцаар "одоо юу хийх вэ" гэдгийг ойлгох ёстой: нүүр хуудсанд 3–4 гол үйлдэл (Бүтээгдэхүүн оруулах, Захиалга, Хүргэлт, Тайлан) том карт/товчлуураар.
- Нэг дэлгэц дээр нэг гол үйлдэл. Хоёрдогч үйлдлийг цэс/accordion-д нуу. Хэт олон товчлуурыг багасга.
- Бүх form: label, алдаа, loading, disabled төлөв, keyboard (Tab/Enter/Esc), 44px хүрэх хэмжээ, mobile (≤390px) дээр хэвтээ scroll-гүй.
- `prefers-reduced-motion`-ийг хүндэтг.

## 5. Dark / Light mode засвар
- Нэг эх үүсвэртэй token систем: `:root` (light) ба dark override-ыг **нэг газар** (`ui-theme.css` эсвэл `dashboard` token файл) тодорхойл. Admin, merchant, dashboard CSS-үүд hex/rgb-г шууд биш `var(--...)` token ашиглана.
- `admin-dark.css`-д тусад нь хуулбарлагдсан dark override-уудыг token руу шилжүүлж, давхардлыг устга. Бусад CSS файл дахь хатуу кодолсон өнгө (`#fff`, `#111`, `rgba(...)`) -ыг grep-ээр ол, token болго.
- Theme сонголт: system / light / dark гурван утга, localStorage-д хадгалагдана, `<html>` дээр SSR үед (inline script эсвэл cookie) тохируулж flash-гүй болго. `useDashboardPreferences` дахь одоо байгаа механизмыг ашигла, шинээр хоёр дахь системийг бүү нэм.
- Шалгах: бүх гол дэлгэц (merchant overview, products, import, orders, delivery, reports, store profile; admin dashboard, products, users, orders, analytics) light ба dark хоёуланд нь: текст/дэвсгэр contrast ≥ 4.5:1, border/input харагдах, chart өнгө, хүснэгтийн hover/selected, modal/dropdown, scrollbar, `<input>` autofill, Excel preview хүснэгтийн алдаа/анхааруулгын өнгө.
- Browser pane ашиглан `npm run dev` ажиллуулж, дэлгэц бүрийг 2 theme × 2 хэмжээ (desktop 1440, mobile 390)-ээр харж баталгаажуул. Эвдэрсэн CSS-г файлаар нь жагсааж, засвар бүрийг тайланд тэмдэглэ.
- CSS-ийг цэвэрлэхдээ `npm run styles:check` / `styles:format` ажиллуул. Ашиглагдахгүй class-ыг устгахаасаа өмнө grep-ээр бүх `src`-д хайж баталгаажуул.

## 6. Дараалал
1. Судалгаа + тайлан → надад товч дүгнэлт үзүүл (эндээс зогсохгүй, үргэлжлүүл, гэхдээ эрсдэлтэй шийдвэрийг асуу).
2. Dark/light token нэгтгэл ба theme механизм.
3. CSS цэвэрлэгээ (давхардал, `!important`).
4. Excel import урсгал (template → preview → commit) + тест.
5. Product editor хялбарчлал, merchant/admin нэгтгэл.
6. Dashboard нүүр, UI/UX дахин зохион байгуулалт.
7. Дүгнэлт: `npm run verify` үр дүн, өөрчилсөн файлууд, шалгаагүй/үлдсэн зүйл, тавьсан таамаглал.

## 7. Хориглосон
- Production өгөгдөл, `.env*`, Supabase migration-ыг надаас асуулгүй бүү өөрчил. Schema өөрчлөлт хэрэгтэй бол санал болгоод зогс.
- Эрх шалгах логикийг сулруулахгүй.
- `git push`, `--force`, branch устгах зэргийг бүү хий.
