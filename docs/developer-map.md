# ProjectN2: өөрчлөх файлаа олох богино зам

Нэг хэрэглэгчийн үйлдэл UI → state → API → database гэсэн хэд хэдэн түвшин дамжина. Зөвхөн өнгө, хэмжээ өөрчлөхөд бүх түвшнийг засах шаардлагагүй. Харин шинэ хадгалагдах талбар нэмбэл форм, validation, API, өгөгдлийн сан, тест хамт өөрчлөгдөх нь хэвийн.

## Homepage motion

- `src/features/home-motion/`: шинэ hero, bento, нийтийн тоон үзүүлэлт, Room/Kitchen demo. Хуучин `home-interior` 3D аялал homepage дээр ачаалагдахгүй.
- `src/features/motion/ModelDemo.tsx`: зураг эхэлж үзүүлэх, дэлгэцэд орсны дараа GLB ачаалах, retry. `ModelDemoCanvas.tsx`: бодит mesh ба demand render.
- `src/lib/demoMotion.ts`: GLB хөдөлгөөний хурд, зогсолт, тасалж шилжих үндсэн тохиргоо. `MotionCursor.tsx`: demo cursor-ийн зам, easing.
- `src/lib/homepagePresentation.ts`: hero-ийн default утга, холбоосын validation, нийтийн статистик. Админы hero форм `AdminHomepageSettings.tsx`.
- `src/features/planner/components/PlannerTourPreview.tsx`: planner болон homepage-ийн нийтлэг бодит GLB заавар; хэрэглэгчийн загварыг өөрчлөхгүй.

## Өнгө, товч, input

- `src/app/ui-theme.css`: нийтлэг өнгө, `--site-button-height`, `--site-input-height`, radius.
- `src/app/globals.css`: `.btn-primary`, `.btn-ghost`, `.input` үндсэн дүрэм.
- `src/app/site-ui.css`: сайт даяарх эдгээр class-ийн харагдах байдал; хэмжээг дээрх token-оос авна.
- `src/features/dashboard/merchant-inputs.css`: merchant/admin input-ийн 44px өндөр, border, textarea, disabled төлөв.
- `src/features/planner/components/planner-tools.css`: Room/Kitchen planner toolbar болон харах горимын товч.
- `src/features/planner/components/planner-responsive.css`: planner-ийн утас/таблет зохицуулалт.

Нийтлэг хэмжээ өөрчлөхдөө token-оос эхэл. Тухайн товч л өөр бол feature-ийн class-ийг шалга. Сайтын бүх button-д шууд global override нэмэх нь 3D viewport-ийн icon, dialog, dashboard-ийг хамт өөрчилдөг.

## Loading

- `src/components/PageSkeleton.tsx`: хуудасны бүтэц (`layout`). Тодорхойгүй хуудас жижиг status үзүүлнэ.
- `src/components/loading/SkeletonParts.tsx`: label + input, текст, жагсаалтын мөрийн нийтлэг дүрс.
- `src/components/loading/loadingForms.ts`: форм бүрийн талбарын нэр, баганын тоо.
- `src/app/page-loading.css`: skeleton-ийн хэмжээ, responsive, dark, reduced-motion.
- `src/app/**/loading.tsx`: Next route-ийн эхний loading. Тухайн хуудасны layout-ийг сонгоно.
- `src/components/RemotePage.tsx`: public API fetch, retry, abort, хуучирсан хариуг үл хэрэгсэх логик.
- `src/components/PlannerLink.tsx`, `src/lib/plannerNavigation.ts`, `src/components/PlannerNavigationFeedback.tsx`: planner рүү дарахад route бэлэн болохоос өмнө шууд харагдах feedback.
- `src/features/planner/components/PlannerEntry.tsx`: хүнд planner bundle ачаалах үеийн loading.

Шинэ формд `loadingForms.ts`-д profile нэмээд route болон dynamic import-ийн fallback дээр ижил `layout` хэрэглэ. Мэдээлэл сэргээхэд байгаа мэдээллийг хадгал. Хадгалж байгаа товчийг бүтэн page skeleton-оор солих шаардлагагүй; disabled/busy төлөв хэрэглэ.

## Merchant / Admin

- `src/components/MerchantDashboard.tsx`, `src/components/AdminDashboard.tsx`: таб сонголт, lazy import, эрхийн gate.
- `src/components/MerchantSidebar.tsx`, `src/components/AdminSidebar.tsx`: цэсний нэр, navigation.
- `src/features/merchant/`: бараа, дэлгүүр, тайлан, импорт, гэрээ, хүргэлт зэрэг feature UI.
- `src/components/AdminKitchenModules.tsx`: гал тогооны GLB нэмэх/засах.
- `src/features/admin-models/ModelsTab.tsx`: ерөнхий тавилгын GLB; kitchen сангаас тусдаа.
- `src/features/dashboard/DashboardFormAssist.tsx`: label холболт, invalid талбарыг харуулах.
- `src/hooks/useDashboardDraft.ts`: хадгалаагүй формын ноорог. Form-ийн input утгыг loading-оор reset хийж болохгүй.

## Planner болон өгөгдөл

- `src/app/(planner)/planner/page.tsx`, `kitchen/page.tsx`: URL entry.
- `src/components/RoomPlanner.tsx`, `KitchenPlanner.tsx`, `ModularKitchenPlanner.tsx`: planner-уудын үндсэн урсгал.
- `src/features/room-planner/`, `src/features/kitchen-planner/`, `src/features/planner/`: тухайн editor-ийн component, style, shared UI.
- `src/features/planner/components/PlannerCatalogToolbar.tsx` ба `planner-catalog-toolbar.css`: Room/Kitchen-ийн **шүүлтүүр → хайлт → эрэмбэ** гэсэн нэг мөр удирдлага. Нийтлэг input/touch хэмжээ, дэлгэгдэх шүүлтүүр, нэрээр эрэмбэлэхийг энд өөрчилнө.
- `src/lib/kitchenFlow.ts`, `src/features/kitchen-planner/components/KitchenPlannerHeader.tsx`: гал тогооны дөрвөн үндсэн шат; хуучин draft-ийн setup/suggestions шатыг хэвээр уншина.
- `src/features/kitchen-planner/components/KitchenWorkflowReview.tsx`: урьдчилсан үнэ болон хэмжилтийн дараагийн алхмын дэлгэц. `kitchen-simple-workflow.css` нь энэ workflow-ийн үндсэн responsive layout; шинэ дүрмийг хуучин долоон шатны CSS-д тарааж нэмэхгүй.
- `src/store/`: browser state; API/DB-ийн эрх шалгалтыг орлохгүй.
- `src/app/api/`: server endpoint, authentication, validation.
- `src/lib/`: дахин ашиглах business logic, types, server helpers.
- `supabase/migrations/`: database өөрчлөлтийн түүх. Хэрэглэгдсэн migration-ийг дахин засахгүй, шинэ migration нэмнэ.
- `tests/`: зан төлөв болон regression тест.

## Хайх командууд (төслийн root дээр)

```powershell
# Дэлгэц дээр харагдаж байгаа текстээс эхэл
rg -n 'Тайлан|GLB нэмэх' src
# URL эсвэл endpoint-оор хай
rg -n '/api/merchant/products|/planner' src
# Нийтлэг товч, эсвэл feature class-ийн style хаана байгааг ол
rg -n 'btn-primary|room-view-dock' src -g '*.css'
# Loading ашиглаж байгаа бүх газрыг хар
rg -n 'PageSkeleton|SkeletonFields' src
# Нэрээр нь файл ол
rg --files src | rg 'MerchantProducts|PlannerLink'
```

Жижиг UI өөрчлөлт: diff → lint → typecheck → тухайн component-ийг browser дээр шалга. Урсгал/API өөрчлөлт: focused tests → бүтэн тест → build → browser. Source test тэнцсэн нь бодит iPhone/Android дээр туршсан гэсэн үг биш.
