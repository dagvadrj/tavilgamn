# Нүүр хуудас — marketplace шинэчлэлт

Шалгасан: 2026-10-02. Хамрах хүрээ: localhost дахь нүүр хуудас болон дэлгүүрийн нийтлэг header, footer, ProductCard.

## Хийсэн өөрчлөлт

- 30px utility, 64px desktop header, 42px хэвтээ ангиллын цэс.
- Бүх ангилалтай хайлт: `/catalog?category=office&q=Студио` нь хоёр шүүлтүүрийг хамтад нь ашигладаг.
- 220px / уян төв / 250px hero. Бодит каталогийн зурагтай гурван слайд, 5 секундийн autoplay, pause болон dot товч.
- 3D planner-ийн том тусдаа баннерийг авч, зөвхөн hero дахь saffron карт үлдээв.
- Хүргэлт, буцаалтын хүсэлт, төлбөр, дэлгүүрийн нөхцөлийн жижиг үйлчилгээний мөр.
- Бодит хямдралын хэвтээ жагсаалт; идэвхтэй хямдралгүй үед “Өнөөдрийн сонголт” гэсэн тодорхой fallback.
- 5 / 3 / 2 баганатай барааны grid, серверийн “Дахин үзүүлэх”, 4 дэлгүүрийн жижиг карт, 4 баганатай navy footer.
- Manrope + Unbounded, Cyrillic subset; shop-д тусгаарласан өнгөний хувьсагч, dark/reduced-motion дүрэм.

## Өгөгдөл ба үнэн зөв мэдээлэл

`readProducts()`, `readStoreDirectory()`, `hasAvailableStock`, `hasProductOffer`, `CATEGORIES`, `force-dynamic` хэвээр. Нүүр хуудас сервер компонент. Carousel/countdown болон одоо байсан wishlist/cart/auth үйлдлүүд жижиг client хэсгүүдэд тусгаарлагдсан. Planner layout, өгөгдлийн сангийн бүтэц, төлбөрийн provider-ийг энэ ажлаар өөрчлөөгүй.

- Үнэгүй хүргэлтийн босгыг `FREE_SHIPPING_THRESHOLD` буюу **1,500,000₮**-өөс уншина. 300,000₮ гэж амлаагүй.
- Батлагдаагүй “14 хоногт буцаалт” гэсэн амлалт нэмээгүй; бодит буцаалтын хүсэлтийн урсгалыг дурдсан.
- Төлбөрийн нэрс checkout-ийн `paymentConfigured` шалгалтаас гарна. Localhost дээр гурван provider бүгд available=false тул “Төлбөрийн тохиргоо хүлээгдэж байна” гэж харагдана. Ямар нэг нууц утга клиентэд дамжуулахгүй.
- Карт/зээл нь **“Тун удахгүй”** гэсэн UI мэдээлэл; ажиллаж буй integration, зээлийн үйлчилгээ эсвэл батлагдсан санхүүгийн нөхцөл гэж үзэхгүй.
- Rating/reviewCount бодит утгаар харагдана. Review тоог “зарагдсан” гэж нэрлээгүй. Sold count/percentage одоогийн schema-д байхгүй тул 78% гэх мэт тоо зохиогоогүй; daily карт дээр бодит үлдэгдэл болон availability мөр ашигласан.
- Дэлгүүрийн рейтинг нь холбогдсон барааны reviewCount-аар жигнэсэн рейтинг; “Барааны үнэлгээ” гэж ялгана.
- Placeholder upload зурагтай барааг нүүр хуудасны сурталчилгаанаас хассан. Catalog/database record устгаагүй.
- Quick-cart нь бодит default өнгө, материалын нэмэлт үнэтэй адил үнэ харуулж, бүх variant-ийн нийт нөөцийн хязгаарыг мөрдөнө.
- Countdown нь Улаанбаатарын өдрийн төгсгөл; барааны promotionEndsAt-ийг өөрчилдөггүй, бүх хямдрал тэр үед дуусна гэж амладаггүй.

## Шалгалт

- Бүх **359 тест** амжилттай.
- ESLint, TypeScript, production build амжилттай.
- Production нүүр хуудас: server-rendered on demand; route JS 2.56 kB, first-load JS 121 kB.
- 1280px: таван grid багана, header 64px, utility 30px, category nav 42px.
- 768px: гурван grid багана; hero-ийн хоёр хажуу хэсэг нуугдсан.
- 390px болон 320px: хоёр grid багана; ангилалтай search label болон secondary header links нуугдсан. Барааны үнийн мөр, бүх хуудас хэвтээ халилтгүй.
- Desktop-ийн харагдах hero болон recommendation зургууд амжилттай ачаалсан.
- Ангилал + “Студио” хайлт зөвхөн 1 matching бараа харуулсан.
- “Дахин үзүүлэх” нь 10 → 17 recommendation карт харуулсан.
- Слайдын dot/pause товч, countdown, гарын keyboard focus-visible дүрэм шалгасан.
- Quick-cart: 1 үлдэгдэлтэй барааг хоёр удаа нэмэхэд нийт тоо 1 хэвээр, нөөцийн хязгаарын тайлбар гарсан. Зөвхөн өөрийн тестээр нэмсэн тэр барааг хасаж сагсыг өмнөх хоосон төлөвт буцаасан. Захиалга үүсгээгүй, мөнгө шилжүүлээгүй.
- Browser console-д runtime error илрээгүй. Catalog хайлтын хуудсын above-fold зурагт Next.js-ийн LCP priority зөвлөмж гарсан; энэ нь төлбөр/өгөгдлийн алдаа биш.
- Dark/reduced-motion нь кодын contract тестээр шалгагдсан; OS-ийн appearance тохиргоог өөрчлөөгүй, dark mode-ийн тусдаа visual screenshot хийгээгүй.

Browser-ийн responsive override-ийг шалгалтын дараа reset хийсэн. Agent browser CLI байхгүй тул байгаа in-app browser-аар шалгасан.

## Файлууд

Өөрчилсөн:

- `src/app/(shop)/page.tsx`
- `src/app/(shop)/layout.tsx`
- `src/app/(shop)/catalog/page.tsx`
- `src/components/Header.tsx`
- `src/components/Footer.tsx`
- `src/components/ProductCard.tsx`
- `src/components/FeaturedMerchants.tsx`
- `tests/marketplace-ui.test.cjs`
- `.gitignore` — энэ ажлын proof/тайланг versioned болгов.

Нэмсэн:

- `src/app/(shop)/storefront.css`
- `src/components/HomeCarousel.tsx`
- `src/components/HomeCountdown.tsx`
- `src/components/ShopHeaderActions.tsx`
- `src/lib/homeMarketplace.ts`
- `src/lib/paymentPresentationServer.ts`
- `tests/home-marketplace.test.cjs`
- Энэ тайлан болон screenshot-ууд.

Энэ нүүр хуудасны ажлаар хуучин файл устгаагүй. Өмнөх Phase 5/planner-ийн git өөрчлөлтүүдийг хадгалсан.

Зургууд: [Desktop](home-marketplace-desktop.png), [Утас](home-marketplace-mobile.png).

**Vercel production сайт руу deploy/push хийгээгүй.**
