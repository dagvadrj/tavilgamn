# IKEA Kreativ: captured frontend catalog/model static шинжилгээ

2026-10-20. Captured JavaScript-ийг inert text байдлаар шинжилсэн; ажиллуулаагүй, дахин татаж аваагүй. Доорх нь тухайн capture-д хүрсэн public frontend-ийн баримт бөгөөд backend implementation болон model authoring process-ийн баталгаа биш.

## Provenance ба coverage

- Runtime source: `ev_c82506f5761ca04bf71ccf205dcf94eae33c1a4de5cac96c35057c6636f25b72`.
- Script export: `ev_551f0d981dd64fcc5b37bf2d3cd595bcea5c879ef8b38a31c1cb24b050b36eae`.
- Manifest: [manifest.json](./ikea-landing-scripts-2026-10-20/manifest.json), capture SHA256 `72032fe94dc3ede2c20743712900ec25e5539e9b6c64307b600c15ce5cd26e7e`.
- REA `analyze_javascript_application` parent evidence: `ev_0378a83a3686df05db660ddac14a8eb10a7572e9b9ed304bf1df5664a43921b1`; summary evidence `ev_7cf875b6f97576de9b26827133e698313c3f0a73e13a08ff72b4472d0268e1a2`.
- REA root artifact SHA256 `3738d265f1ee7b7224db38b29c9ed662672fe9bdf50cb8c920edd998b4c85250`. 4 сонгосон JS, 138839 text bytes, 74 module, parse failure 0; 58 өөр inventoried файл сонгоогүй. Application/semantic graph coverage partial.
- Home-design-ийн app/framework болон олон том chunk 64 KiB retained-content budget-аас хэтэрсэн. Зарим chunk 16 concurrent-read budget эсвэл response-content-not-retained шалтгаанаар байхгүй. Тиймээс asset loader, backend endpoint, variant solver-ийн бүх кодыг сэргээсэн гэж үзэхгүй.

Доорх offset нь эх minified UTF-8 текстийн zero-based character offset; ASCII нэрсийг хайж яг хэсгийг дахин олж болно. Бүх JS public origin: `https://www.ikea.com/us/en/home-design/`.

## A. Product data нь model URL-аас хавьгүй баялаг

Файл [80e165...8855.js](./ikea-landing-scripts-2026-10-20/files/origins/989303cdea04cea89a340a8dc88aa67842a9c699839a9b8ccede7f43bac3509a/us/en/home-design/80e165c2f590ef4533bc1e989b89ca002bc83fd1-461b204543c1f7898855.js), source request-214, SHA256 `53596e41530cdd00b1b0ef532667a365365c9aa72b2061e424823106d1b0be7a`.

Offset 34572 орчим normalization object-д:

- commercial identity: `id`, `region`, `globalProductId`, `localItemNumber`, `ecommerceUrl`, `price`, `availableInRegion`;
- taxonomy/discovery: `collections`, `rootCategories`, `categoryIds`, `subCategories`, `recommended`, `swappableItems`, `goesWithItems`;
- render: `renderType`, `modelUrl`, `materialUrl`, `rotX`, `scale`, `min/max`, `uncompressedModelSize`, `productGeometries`;
- behavior: `stacks`, `stackables`, `placeables`, `requiresWallContact`, `isSnapRotable`, `isNoninteractable`;
- composition: `combinablesSocketSet`, `combinablesMetadata`, `combinablesPlugs`, `combinablesDefaultProducts`;
- configuration/import: `configurationData`, `isSupportedConfiguration`.

`materialUrl`-ыг `productGeometries.productMaterials[0].url`-аас авч байгаа код ажиглагдсан. Энэ нь geometry/material тусдаа references байж болохыг батална; яг ямар texture channel, compression, asset authoring software хэрэглэснийг батлахгүй.

## B. Placement behavior-ийг тусгай дүрмээр ялгадаг

Файл [8de51...9111.js](./ikea-landing-scripts-2026-10-20/files/origins/989303cdea04cea89a340a8dc88aa67842a9c699839a9b8ccede7f43bac3509a/us/en/home-design/8de51afe8ad06b3c857cbb5b1977fd0d1f3d2e42-ef20f398deaf5aff9111.js), request-213, SHA256 `91ceec21edc211b492559343c96cea354f7a1b45a15ed2b3d3b3bbb159e85687`.

Offset 3079–3540: predicate-уудыг `ON_WALL`, `WALL_OR_FLOOR`, `WALL_AND_FLOOR`, `WALL_AND_FLOOR_CORNER` behavior-тэй холбож, тохироогүйд `ON_FLOOR` буцаах classifier байна. Predicate-ийн эх код capture-д бүрэн биш учир бүтээгдэхүүний аль metadata field яг ямар behavior сонгуулдгийг бүрэн тогтоогоогүй.

Манай planner-д авах сургамж: дээд/доод шүүгээг зөвхөн нэрийн keyword эсвэл ойролцоо asset-аар сонгохгүй; placement metadata ба typed category-аар баталгаажуулах хэрэгтэй. Энэ нь analyst recommendation, IKEA-ийн exact cabinet logic гэсэн үг биш.

## C. Composable furniture geometry selection

Ижил `8de51...9111.js`, offset 2476–3078: `productGeometries.dynamic` жагсаалтаас socket-ийн `category`, `size`, мөн parent-ийн `combinablesMetadata` нөхцөлийг тааруулж geometry сонгоно; тохирохгүй бол `productGeometries.simple` fallback хэрэглэнэ. Offset 2069 орчим anchors-ийн `matrixModel` 4×4 хэлбэрийг шалгадаг.

Дүгнэлт: зарим тавилга бол ганц mesh бус, metadata + socket/plug + parent нөхцөлтэй composition. Энэ нь ямар нэг kitchen cabinet system бүгд ийм гэсэн баталгаа биш.

## D. Placement warnings нь render state ба room context-ийг ашигладаг

`80e165...8855.js`, offset 3450–6100 орчим: render items-ийг `furnitureById`-тай нэгтгэн product facts гаргана. `parentId`-тай child болон noninteractable эдлэлийг тусдаа excluded болгож, loading/placement pending үед evaluation-ийг хүлээлгэдэг. Бэлэн item-ийн `collisionState`, product facts, `roomContext`-ийг evaluator руу дамжуулна.

Offset 6463 onward issue enum: `requires-wall-contact`, `product-too-tall`, `door-window-overlap`, `product-too-wide`. Context нь `room-builder`, `photographic`, `unknown`; severity нь `warning` эсвэл `tip`; санал болгох action нь `select-item`, `edit-room`, `customize-product`.

Дүгнэлт: байрлуулалт ба чанарын зөвлөгөө нэг нэрийн шалгалт биш, room/product/render төлөвийг нийлүүлсэн layer. Гэхдээ энэ capture-аас collision math, exact tolerance, opening clearance бүгдийг сэргээх боломжгүй.

## E. Drag-and-drop болон variant маягийн тохиргоо

`80e165...8855.js`, offset 1919: `dragDrop/placeProductViaDragDrop` action productData.id, renderType болон scene/context ашиглан placement dispatch хийнэ. Нэг render төрөлд `heading`, `stacks`, `hidden`, `placeables`; өөр төрөлд `matteId`, `frameId`, `sizeId`, `colorId`, `customHeight` defaults орно.

Энэ нь config fields байгааг нотолно. `matteId/frameId`-аас харахад тухайн branch зураг/хүрээ зэрэг төрөлд хамаарч болох боловч imported constant-ийн утгыг батлаагүй; бүх sofa/cabinet өнгө солих систем гэж дүгнэхгүй.

## F. Room builder-ийн assets/state

Файл [68da...ddc5.js](./ikea-landing-scripts-2026-10-20/files/origins/989303cdea04cea89a340a8dc88aa67842a9c699839a9b8ccede7f43bac3509a/us/en/home-design/68da09307fd5d0139d52e395ab06059456e80c68-a591fe85fda2c43bddc5.js), request-215, SHA256 `766eaa1cf6e3a2d76037b455b56abc107e7e86de98287a3ec9debd0bbd8386e2`.

Offset 1060: scene payload-д `sceneId`, `name`, `gltf`, `envmap`, `composition` fields байна. Offset 2137 onward planner selectors нь `templates`, `materials`, `doors`, `windows`, `assets`, selected template/material/color, editMode, loading states ялгана. Offset 3202: `assetType === MODEL` болон `semanticClass.includes(LIGHT)`-ээр гэрлийн model assets сонгодог.

Зөв дүгнэлт: room geometry/composition, finish material, openings, lighting semantic assets нь тусдаа data/state. `gltf` гэсэн field байгаа нь бүх furniture asset заавал нэг GLB файл гэсэн баталгаа биш.

## G. Starter sets ба автомат байрлуулах төлөв

Файл [1cd1...26b2.js](./ikea-landing-scripts-2026-10-20/files/origins/989303cdea04cea89a340a8dc88aa67842a9c699839a9b8ccede7f43bac3509a/us/en/home-design/1cd1d6c43331e04cdf87f9472299f7adbbbeb883-e5815c008a2c7e8f26b2.js), request-212, SHA256 `31a1f88cbdd48d2004a787183f5368a7ca966561bf3a6af36865812137d64fc5`.

Captured text-д `starterSet.loadedFurnitureSetUuids`, `starterSet.placement.activeItemUuids`, LOADING/PLACING states, `/showrooms/?tag=...` хэрэглэгчийн set/showroom урсгал байна. Imported PAX-д `smarta` status `not-used`/`failed`, `placement.status === automatic`, `unsupported-product` fallback хэллэг ажиглагдсан.

Энэ нь starter set болон automatic placement subsystem байгааг нотолно. Түүний exact алгоритм ML үү, rule search уу, training data юу, 5 санал хэрхэн эрэмбэлдэг вэ гэдгийг энэ хэсгээс тогтоож болохгүй.

## Хэрэгжүүлэлтийн дарааллын санал

1. Бүтээгдэхүүний зөв identity/category/mount metadata; зөв хэмжээ/asset/material contract.
2. Scene instance transform ба catalog product-ийг салгах; mount behavior, support plane, bounds, contact rules.
3. Placement evaluator: pending/excluded/evaluated state, хана/хаалга/цонх/өрөөний хэмжээний issue, засах action.
4. Context actions, same-position swap, duplicate, style/config variants.
5. Room builder template/openings/material/light data; гөлгөр rendering/asset loading.
6. Үүний дараа validated starter-set/layout candidates ба зөв таван санал. ML шаардагдах эсэхийг data/зорилгоор тусад нь шийдэх.

## Нэмэлт: editor passive capture-аас том chunk-уудыг шалгасан нь

Шинэ source: `ev_67d9f6277d78afd5f40be2abac2e0acf7f7523b030358793f562f129daa3b1bd`; export `ev_36cc9c9b8c23868c579ed8744bb46df4ca14601bf1a4c42b207127ba8b7b5332`; [шинэ manifest](./ikea-editor-scripts-2026-10-20/manifest.json). Энэ нь 157 exported script, 1 unavailable гэсэн илүү бүрэн passive capture. Дээрх landing capture-ийн 64 KiB хязгаар шинэ artifact-д хамаарахгүй; шинэ 281 KiB, 422 KiB, 1.39 MiB chunk-уудын холбогдох жижиг хэсгийг inert text-ээр уншсан. Шинэ бүх source tree-г REA semantic graph болгон шинжлээгүй, backend source/model-authoring toolchain одоо ч unknown.

Доорх short filename-ийн бүрэн root нь `research/ikea-editor-scripts-2026-10-20/files/origins/989303cdea04cea89a340a8dc88aa67842a9c699839a9b8ccede7f43bac3509a/us/en/home-design/`. Hash/provenance-г шинэ manifest-аас шалгана.

### Catalog API нь browsing, variants, substitutes, complementary items-ийг салгадаг

`65cf681db574c1fa56c9f838b572d61c5047371b-d0039fcd915a52523d88.js`, offsets 163983–167650:

- `/furniture/`: region, sub_catalogs, category_id, sub_category_id, room_type, stacks, limit/offset, geometry_type, store/zip, sort, `material_mode:true`.
- `/furniture/search/`: query `q`, region, store/zip, store-stock/online-sellable filter, continuation `moreToken`, geometry type, sort, material mode.
- `/furniture/search-category/`: category, size/start/end, store availability болон ижил filters.
- `/furniture/` дээр `id__in`, эсвэл `local_item_number`-оор exact product lookup.
- `/furniture/{id}/swappables/`: `exclude_variants:true`, offset/limit, store/zip. Ижил family-ийн өнгө/хэмжээний variant-оос alternative product-ийг тусгаарлаж байгаа static evidence.
- `/furniture/{id}/recommendations/`: мөн exclude_variants, store/zip, limit.
- `/furniture/{id}/variants/`: material_mode, store/zip; composable child-д `plugs_into` JSON `{size,category}` нэмж socket compatibility хязгаарладаг.
- `/adv_recommendations/`: POST data `{room_type,nbr_of_items:3,current_items}`. Энэ бол API request shape; ranking backend ML/heuristic гэдгийг батлахгүй.

Эдгээр нь request construction code, capture-д бүгд сүлжээгээр бодитоор дуудагдсан гэсэн үг биш. API-г шууд дахин дуудаагүй.

### Variant сонголт нь бодит product ID-тай

`326c12863b0fb14e1f47a81c5818226e5ddcee64-a58ec0d382cddcefca84.js`, offsets 10919–14000: variant groups `type`, `typeName`, `showThumbnail`, `options`; option нь `productId`, `valueKey`, `thumbUrl`. UI нь radiogroup/radio, aria-checked, keyboard arrow/Enter/Space navigation-тай. Сонголт нь selected scene instance `uniqueId` ба шинэ `productId`-ыг холбосон swap action илгээнэ.

Одоогийн болон replacement item хоёулаа `materialUrl`-тай бол material swap action; бусад тохиолдолд full furniture swap action сонгоно (offset 13858). Ижил branch general “Swap with similar”-д ч байна (offset 26537). Эндээс arbitrary RGB recolor-аас илүү бодит catalog variant ID чухал болох нь харагдана.

`65cf...23d88.js`, offset 8250–9600: material swap branch нь linked combinable children-ийг parentId+linkGroupName-аар олж socket geometry compatibility шалгаад `modifySceneItem(...newMaterialUrl)` хийнэ. Иймээс linked family-ийн finish солилтыг ганц instance-ийн өнгөнөөс илүү data-aware хийдэг.

### Model loader, cache, материал ба гэрлийн тохиргоо

`bf06317352297aad4eacd7eddd2bdeb5833fe120-7d80c638b6921d3f3dba.js`:

- Offset 1267893: application loader нь GLTFLoader үүсгэж DRACOLoader холбоод decoder path `//www.gstatic.com/draco/versioned/decoders/1.4.3/` тохируулж preload хийнэ. Энэ нь loader capability/configuration; бүх model заавал Draco-compressed гэдгийг батлахгүй.
- Offset 1268168: `loadModelFromUrl` glTF scene ачаалж, model configuration/render readiness promise-ийг хүлээгээд configure хийнэ.
- Offset 1268737: mesh material setup-д cast/receive shadows, transparency/depthWrite, texture anisotropy=8, bounding box, environment cube map/intensity, optional filmic LUT/x-ray material handling байна. Vendor GLTFLoader дотор KTX2 capability байгаа ч application KTX2-г enable хийснийг энэ судалгаа батлаагүй.
- Offset 1273550: URL-keyed modelTable Map, in-flight download promise sharing, cached model deep-copy, reference counting, release/dispose. Зөвхөн repeated network download бууруулахаас гадна instance бүрийн transform/state-г хуулбарт салгах механик байна.
- Offset 517650: `updateMaterial` нь material URL-оос material авч render object's материалд тавин renderer-ийг dirty болгоно.
- Offset 518250: `configurationData.assets[].uri`-гаар олон model ачаалах ба configuration model угсрах branch байна.

Өмнөх “asset loader тодорхойгүй” хязгаар одоо нарийссан: frontend glTF+Draco loader, URL cache/refcount, material swap болон render setup-ийн тодорхой хэсэг батлагдсан. Харин CAD source, artist workflow, retopology/baking, texture resolution/LOD budgets, license болон backend asset processing pipeline батлагдаагүй хэвээр.
