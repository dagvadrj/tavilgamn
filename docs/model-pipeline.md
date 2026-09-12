# Тавилгын GLB pipeline

Энэ өөрчлөлт одоогийн Next.js / Three.js / R2 төсөлд ажиллана. Blender боловсруулалтыг хөгжүүлэгчийн компьютер эсвэл тусдаа build worker дээр нэг удаа хийнэ. Хэрэглэгчийн браузер эх 300k моделийг багасгаж тооцоолохгүй.

## Ажиллуулах

Node.js 22, Blender 4.2+ (энд 5.0.1 дээр шалгасан), Khronos KTX-Software 4.4.2 хэрэгтэй. `npm ci` нь pinned glTF Transform CLI 4.5.0-ийг суулгана. KTX-ийн `bin` хавтаст `ktx.exe` болон хамт ирдэг DLL-ууд байх ёстой. Энэ компьютерт `.tools/ktx/bin` бэлэн; уг binary багц кодын ZIP-д ороогүй.

Төслийн үндсэн хавтсаас PowerShell дээр:

```powershell
npm ci
# R2 дээрх хамгийн том хоёр эх GLB-г татна. Сервер рүү бичихгүй.
npm run models:fetch -- --output model-work/new-source --limit 2

# Output нь өмнө үүсээгүй шинэ хавтас байна.
npm run models:pipeline -- --input model-work/new-source --output model-work/new-build --ktx-bin .tools/ktx/bin
```

Blender өөр газар суусан бол `--blender "D:/Apps/Blender/blender.exe"` нэмнэ. FBX/OBJ/GLB файлуудтай өөрийн хавтсыг `--input`-д өгч болно. FBX/OBJ-ийн texture/MTL файлуудыг эх моделийн хамт байрлуулна. `--high 30000 --medium 15000 --low 5000` нь анхны зорилтот төсөв. Аль хэдийн жижиг моделийг зориуд томруулахгүй.

R2 таталт одоо байгаа `.env.local`-ийн `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`-ийг ашиглана. Түлхүүрүүдийг frontend кодод хийхгүй. Файлын замыг `furniture_models.glb_path` баганаас авна; гараар R2 зам хайх шаардлагагүй. Татсан файлын нэр, хэмжээ `sources.json`-д хадгалагдана.

Бүх алхмыг тусад нь ажиллуулах боломжтой:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.0/blender.exe' --background --python-exit-code 1 --python scripts/models/blender_batch.py -- --input model-work/new-source --output model-work/new-geometry
npm run models:compress -- --input model-work/new-geometry --output model-work/new-compressed --ktx-bin .tools/ktx/bin
```

## Геометр ба чанарын шалгалт

Polygon-ийг эхлээд triangle болгож тоолно. High төсөв нь **бүтэн моделийн бүх объектын нийлбэрээр 30,000-аас ихгүй**. Объект бүрийн ratio = тухайн объектод хуваарилсан төсөв / эх triangle тоо; жижиг хэсгүүдэд хамгийн бага төсөв үлдээнэ. LOD бүрийг эх геометрээс тусад нь үүсгэнэ.

Хоёр чиглэлийн surface sampling, bounding-box drift, normal deviation болон дөрвөн тогтмол өнцгийн silhouette/shading diff шалгана. Зургийн шалгалтад унасан medium/low төсвийг 1.4 дахин өсгөж, өмнөх LOD-ийн 95%-аас хэтрүүлэхгүй дахин туршина. High 30k дотор шаардлага хангахгүй бол asset алдаатай дуусна. Дутуу LOD багцыг compression шат хүлээж авахгүй.

`geometry-report.json`-д surface болон visual шалгалтыг `passed`, normal шалгалтыг тусад нь `normalWarning` гэж хадгална. **Normal анхааруулга нь экспортыг хориглохгүй.** Дөрвөн зураг бол энгийн шалгалт; нарийн нугалаас, доод тал, texture-ийн алдагдлыг бүрэн батлахгүй. Бодит хоёр буйдангийн бүх LOD normal анхааруулгатай; эх/LOD PNG-ийг харьцуулж, ойроос ашиглах чанарыг хүн шалгасны дараа каталогт солино. Animation, skin, morph агуулсан mesh-ийг энэ static furniture pipeline хүлээж авахгүй.

## Шахалт ба atlas

Node скрипт GLB файлуудыг цуваа боловсруулна: dedup → prune → resize → KTX2 → Draco. Texture дээд хэмжээ high/medium 2048, low 1024; compression скриптийн `--texture-size`-аар тохируулна. Base color/emissive нь ETC1S, бусад PBR map нь UASTC + Zstd. Draco хамгийн сүүлд position 14 bit, normal 10 bit хэрэглэнэ.

`compression-report.json`-ийн beforeBytes нь Blender-ээс гарсан GLB хэмжээ; R2 эх файлын хэмжээг `sources.json`-оос харьцуулна. Материал, texture slot, UV transform, repeat sampler зэргийг atlas audit-д шалгана. Atlas автоматаар bake хийхгүй: base color, normal, ORM нь тусдаа утгатай тул нэг image болгон сольж болохгүй. Туршсан буйдангууд тус бүр нэг материалтай, repeat sampler-тай тул автоматаар atlas хийх candidate биш.

## Админд оруулах

Шинэ upload болон бүтээгдэхүүний GLB солих хэсэгт LOD нэмэлт сонголт бий:

1. Үндсэн GLB: `model-<version>-0.glb` (high).
2. Medium: ижил version-той `-1.glb`.
3. Low: ижил version-той `-2.glb`.

Гурвыг нэг бүтээгдэхүүнд хамт сонгоно. Upload нь metadata дахь эх файлын SHA256, ижил bounding box, буурах triangle тоог шалгана. Low/medium-ийг түрүүлж, high-ийг дараа байршуулж, зөвхөн бүрэн багц бэлэн болсны дараа DB дахь high замыг ашиглана. Дундаас upload алдаа гарвал шинээр байршуулсан хэсгийг цэвэрлэнэ. Файлын нэр шинэ UUID-тай тул өмнөх эхийг дарж бичихгүй. SQL migration шаардлагагүй. Хуучин ганц GLB upload мөн ажиллана; түүнийг автоматаар 30k болгож хувиргахгүй.

Энэ ажлын хүрээнд R2 дээрх бүтээгдэхүүнүүдийг солиогүй. `optimized-models.zip` нь админд сонгон оруулах зургаан GLB, тайлан болон эх/LOD preview зургуудтай.

## Runtime ба олон хэрэглэгч

`GLBFurnitureMesh` эхлээд бүтээгдэхүүний хэмжээгээр bounding-box placeholder үзүүлж, low-г татна. Дараа камерын зайгаар high/medium/low солино. Ойролцоогоор 3.4 m дотор high, 11.5 m-ээс цааш low; буцах зааг 4.6 / 8.5 m тул зааг дээр байнга солигдохгүй. Сонгосон тавилга high ашиглана. LOD бүрийн эх bounding box ижил тул солигдоход хэмжээ/байрлал өөрчлөгдөхгүй. Legacy нэртэй файл ганц GLB хэвээр ачаална.

Renderer бүр Draco/KTX2 loader pool-той, decoder тус бүр хоёр worker, нийт asset load зэрэгцээ гурав хүртэл. Ижил URL-ийн таталтыг хуваалцана. Ашиглаж буй model cache-д хадгалагдаж, ашиглаагүй дөрөв хүртэл үлдэнэ; бүх хэрэглэгч салснаас 30 секундийн дараа pool цэвэрлэгдэнэ. Instancing helper нь ижил геометр, материалтай гурав ба түүнээс олон static leaf хэсгийг нэг InstancedMesh болгоно. Animation, transparency, mirror/shear зэрэг тохирохгүй хэсгийг алгасана. Нэг mesh бүхий буйдангаас давтагдах тусдаа модуль автоматаар гаргаж авахгүй.

`npm run dev` / `npm run build` өмнө matching Three.js Draco/Basis decoder-ууд `public/decoders` руу хуулна. Deploy хийхдээ `public` хавтсыг хамт байршуулна.

Олон хэрэглэгчид CDN-ээр түгээх бол R2 bucket-д өөрийн custom domain холбож, зөвхөн нийтийн каталогийн asset-уудыг түгээнэ. Серверийн `R2_PUBLIC_BASE_URL=https://assets.example.com` тохиргоо нь уг домэйн рүү URL өгнө. Тохируулаагүй бол одоогийн signed URL хэвээр ажиллана. Cloudflare Cache Rule-д version-той GLB замуудыг cache eligible болгож, object Cache-Control-ийг ашиглана. R2 CORS-д сайтын origin болон GET/HEAD зөвшөөрнө. CORS өөрчилсөн бол хуучин cached хариуг шинэчилнэ. Энэ код cloud domain, cache rule, CORS-ийг өөрөө идэвхжүүлээгүй. [Cloudflare cache](https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/), [CORS](https://developers.cloudflare.com/r2/buckets/cors/).

## Бодит үр дүн ба verification

Хэмжээ MiB (1,048,576 byte), triangle тоо нь Blender тайлангийнх.

| Модель | Эх triangle | High / medium / low | Эх MiB | High / medium / low MiB |
|---|---:|---|---:|---|
| Luna 3-Seater Sofa | 294,832 | 30,000 / 21,000 / 13,719 | 25.95 | 2.29 / 2.22 / 0.86 |
| LUNO Modern Sofa | 289,134 | 29,999 / 21,000 / 13,720 | 30.54 | 1.43 / 1.36 / 0.53 |

67 автомат тест, typecheck, production build амжилттай. Бодит зургаан GLB-ийн Draco-г буцааж decode хийж triangle/position шалгасан; доторх 12 KTX2 image `ktx validate` давсан. Хоёр багц upload validator-оор зөвшөөрөгдсөн. FBX болон OBJ 528-triangle fixture-ууд гурван LOD экспортоор шалгагдсан. glTF CLI validator алдаагүй, зарим extension-ийг өөрөө decode хийдэггүй тухай warning өгсөн. Browser/GPU frame-time болон олон хэрэглэгчийн load benchmark хийгээгүй.

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

Хэрэглэсэн API: [Blender Decimate](https://docs.blender.org/api/5.0/bpy.types.DecimateModifier.html), [glTF Transform CLI](https://gltf-transform.dev/cli), [KTX-Software 4.4.2](https://github.com/KhronosGroup/KTX-Software/releases/tag/v4.4.2), [DRACOLoader](https://threejs.org/docs/pages/DRACOLoader.html), [KTX2Loader](https://threejs.org/docs/pages/KTX2Loader.html).
