# Sofa delivery — source surface хадгалах profile

Original GLB болон `C:/GLB_BAKE/auto_bake.py` өөрчлөгдөхгүй. Offline CLI шинэ output үүсгэнэ. Web-ийн original upload → worker урсгалд мөн холбогдсон; шинэ job ганц delivery GLB publish хийнэ.

## Одоо ашиглах Luna

`model-work/luna-single-delivery-2026-10-16/compressed/wurBQFrua2-24KFuBzHnC/`

- Source: **41,687,504 bytes / 297,424 triangles**.
- Delivery: **1,952,012 bytes / 69,913 triangles**; hash `compression-report.json`-д. Worker-ийн Blender normalization дамжсан шинэ үр дүн.
- Original-оос geometry 76.5%, download хэмжээ ойролцоогоор 95.3% багассан.
- Шинэ job preview GLB үүсгэхгүй, upload хийхгүй. Viewer хуучин preview зам ирсэн ч зөвхөн delivery-г татна.
- Original UV, PBR texture холбоос, authored shading normal-ыг хадгална. Өнгө болон normal-ыг өөр surface руу дахин projection хийхгүй.
- Color2048 WebP92; metallic/roughness2048 KTX2 ETC1S quality255/RDO off. Шинэ normal/AO map нэмээгүй.
- Өрөөний planner camera болон тавилга хөдөлгөхөд mesh/texture солихгүй; DPR-ийг түр бууруулаад зогсоход сэргээнэ. Ачаалах зуур хэмжээнд нь таарсан placeholder харагдана.

Өмнөх `luna-planner-ready-2026-10-16`, `luna-seam-repair-v1...v5`, `luna-authored-surface-v1` нь туршилтын хувилбарууд. Тэдгээрийг final гэж ашиглахгүй.

## Цуурлын судалгааны дүгнэлт

1. Map isolation дээр normal map-ийг салгахад урт хар зураасны ихэнх арилсан. Өнгөөр будах нь бүх алдааг шийдэхгүй байв.
2. Source glTF нь UV/normal заадлаар салсан vertex олонтой. Blind collapse нь энэ topology-д ирмэгийн зөрүү үүсгэж болно.
3. Blender vertex group weighting нь hard lock биш. Нээлттэй ирмэгийн байрлал хадгалах integration test нэмсэн; protected simplification одоо Meshopt `LockBorder` ашиглана.
4. Геометрийн нээлттэй ирмэгийг давхцсан UV/normal заадлаас ялгаж, хамгаалсан байрлал алга болсон эсвэл шинэ open edge гарсан candidate-ийг унагана.
5. 24k rebake candidate-д 6 шинэ open edge гарч унасан. 36k нь geometry gate давсан ч close-up дээр projection/shading алдаа үлдсэн тул чанарын хувилбар гэж сонгоогүй.
6. Original UV/PBR-аа хадгалсан 24k нь цуурал багатай боловч хавтгай хэсэгт interpolation/faceting илэрсэн. Surface-distance gate ганцаараа зураг чанарын баталгаа биш.
7. Энэ Luna-д original visible surface-ийг дахин decimate хийхгүй, view-sampled hidden geometry-г хассан **69,918 triangle** profile сонгосон. 26 exterior direction болон authored normal чиглэлийг centroid visibility-д ашиглаж, occlusion boundary орчмын хоёр ring-ийг хадгална.
8. Original UV дээр MR512 нь хэсэгчилсэн гэрэлтэлтийн ялгаатай байсан тул delivery MR2048 болгосон. ETC1S-ээр шахаж хэмжээний өсөлтийг хязгаарласан.

IKEA яг ямар дотоод bake pipeline ашигладгийг энэ script нотлохгүй. Энэ source-ийг автоматаар 22–24k болгож pixel-identical чанар хадгалсан гэж үзэхгүй. Түүнд илүү нягт retopology, part separation болон source-aware baking шаардлагатай байж болно.

## Blender Text Editor → Run Script

1. Original `.glb`-ээ **`C:/GLB_BAKE/input/`** дотор тавина.
2. Ганц GLB байвал автоматаар сонгоно. Олон бол script-ийн `TEXT_EDITOR_INPUT_GLB`-д бүтэн зам бичнэ.
3. Repository дахь шинэчилсэн **`scripts/models/sofa-quality-bake.py`** файлыг Blender Text Editor-оор шинээр нээнэ. Өмнө paste хийсэн `Text.001` автоматаар шинэчлэгдэхгүй.
4. `TEXT_EDITOR_PROJECT_ROOT` нь `C:/Users/HiTech/Desktop/ProjectN2` мөн эсэхийг шалгана.
5. Default `TEXT_EDITOR_EXTERIOR_ONLY=True`, `TEXT_EDITOR_REBAKE_SURFACE=False` хэвээр ажиллуулна.
6. Run Script нь нээлттэй scene/text-ийг цэвэрлэхгүй; тусдаа background Blender эхлүүлнэ. Output **`C:/GLB_BAKE/output/<model>_quality_<timestamp>/`**.
7. Эхэлсэн popup нь bake дууссан гэсэн үг биш. Log болон `bake-report.json` status `ready-for-visual-review` болсон эсэхийг шалгана.
8. Offline гарсан `delivery.glb` нь шалгах final файл. Web-ийн admin урсгалд original GLB-ээ upload хийнэ; worker өөрөө боловсруулна. `baked-source.glb`, `delivery-review.glb` болон intermediate-ийг upload хийхгүй.

`C:/blender_batch.py` олдохгүй байсан хуучин алдаанд virtual `\\Text.001`-ийг disk path гэж үзэхгүйгээр repository helper-уудыг хайдаг болсон.

## CLI — одоогийн Luna profile

Repository root дээр PowerShell; өмнө байгаагүй шинэ output directory ашиглана:

```powershell
& "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --python-exit-code 1 --python "scripts/models/sofa-quality-bake.py" -- --input "C:/GLB_BAKE/input/wurBQFrua2-24KFuBzHnC.glb" --output "model-work/Luna-clean-new" --ktx-bin ".tools/ktx/bin" --exterior-only --keep-authored-surface --target-triangles 70000 --samples 8192 --geometry-codec meshopt --color-size 2048 --orm-size 2048 --orm-codec etc1s
```

Target70000 гэдэг нь бүх model-ийг 70k дээр чанартай болгоно гэсэн үг биш. Luna-ийн exterior base 69,918 тул энэ profile харагдах гадаргууг дахин decimate хийхгүй. Өөр model дээр geometry, shading, close-up-ийг дахин шалгана.

Blender5.x, installed Node/project dependencies, `.tools/ktx/bin` болон decoder assets шаардлагатай. Эдгээр файл хамт байна:

- `sofa-quality-bake.py`
- `sofa-quality-compress.mjs`
- `sofa-simplify.mjs`
- `sofa_exterior.py`
- `blender_batch.py`

Python файл дангаараа portable биш.

## Verification ба хязгаар

- Source hash job-ийн өмнө/дараа ижил; existing output-ийг overwrite хийхгүй.
- Encoded glTF validator болон texture/geometry decode хийсэн review-г тусад нь шалгана. Compressed extension validator coverage хязгаарлагдмал.
- Default original/derivative/compressed тус бүр дөрвөн өнцгийн 12 PNG гарна. `--generate-preview` нь зөвхөн хуучин offline туршилтад зориулсан opt-in; worker хэрэглэхгүй.
- Blender integration guard: source өөрчлөгдөхгүй, opposite sheets нийлүүлэхгүй, open rim байрлал, original UV, authored normals болон virtual Text helper lookup.
- Browser GPU transcode, mobile, олон тавилгатай FPS-ийг эдгээр PNG/test орлохгүй. Live catalog дээр нийтлээгүй.
- Texture resize/compression нь pixel-identical биш. 2048 color нь original4096-ийн нарийн ширхэгийг тодорхой хэмжээнд зөөлрүүлнэ; өнгөний maximum detail шаардвал `--color-size 4096` хэмжээ нэмэгдүүлнэ.
- Visibility нь view-sampled. Шинэ өнцөг, нарийн завсар, grazing angle дээр шинэ asset бүрийг шалгана. Opaque/static furniture-д зориулсан; glass/alpha/transmission, онгойх/салгах дотор geometry-д тохирохгүй.
- Rig/animation/morph/KTX2 source-ийг татгалзана. Exactly one source UV set шаардлагатай. Authored-surface simplification-д vertex бүрийн UV нэг утгатай, glTF шиг split бүтэцтэй байна.

Advanced rebake: `TEXT_EDITOR_REBAKE_SURFACE=True` нь UV reprojection + normal/AO bake profile. Энэ Luna дээр close-up алдаа илэрсэн тул default биш, visual approval шаарддаг. `--rebake-uv` ба `--keep-authored-surface` зэрэг ашиглахгүй.

Guard check:

```powershell
& "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --python-exit-code 1 --python "tests/blender-sofa-quality.py"
```

References: [Blender baking and ray/cage settings](https://docs.blender.org/manual/en/latest/render/cycles/baking.html), [Meshoptimizer simplifier and LockBorder](https://github.com/zeux/meshoptimizer/tree/master/js#simplifier), [glTF Transform ETC1S](https://gltf-transform.dev/cli#etc1s).

## Web / worker — single delivery

- `models:worker` original source-ийг тусдаа temp folder-т татаж, checksum-ийг шалгана.
- `sofa` category дээр `sofa-surface` profile сонгоно. Static, opaque, нэг UV set-тэй, core PBR model-д харагдах surface-ийн UV, authored normal-ыг хадгалан hidden faces-ийг view sampling-аар цэвэрлэнэ. Worker visible surface-ийг triangle target-д хүчээр decimate хийхгүй.
- Animation/skin/morph, alpha/material extension, socket/anchor, node extras/extension, KTX2 source зэрэг unsupported metadata илэрвэл surface extraction хийхгүй, `preserve` profile руу шилжсэн шалтгааныг `delivery-profile.json`-д бичнэ. Энэ нь Blender бүх ийм source форматыг дэмжинэ гэсэн баталгаа биш; unsupported import бол job error болж source үлдэнэ.
- Гал тогооны part/assembly болон бусад category geometry-preserving profile ашиглана. Socket transform, final decoded bounds/origin шалгалт хэвээр.
- Ердийн compression normal map-д UASTC, бусад map-д ETC1S хэрэглэнэ. Luna profile color2048 WebP92 + MR2048 ETC1S, Meshopt position16/normal12/UV16.
- Immutable job path-д нэг delivery upload хийж, job/status guard-тай publish дээр `preview_glb_path=null` болгоно. Existing nullable column тул schema migration шаардлагагүй. Хуучин preview ledger entry retired болж, R2 history устахгүй.
- Source cleanup ганц delivery объект байгаа эсэх, model/job/source замууд тохирч байгаа эсэхийг шалгана. Preview шаардахгүй. Publish алдагдсан response, stale job болон дутуу delivery үед cleanup хамгаалалт хэвээр.
- Frontend, worker process-ийг шинэ кодоор restart/redeploy хийсний дараа үйлчилнэ. Энэ өөрчлөлтөөр live catalog-ийг дахин боловсруулаагүй, historical preview объектуудыг бөөнөөр устгаагүй.

Local integration:

```powershell
node scripts/models/pipeline.mjs --input C:/GLB_BAKE/input --output model-work/new-single-delivery --geometry-profile sofa-surface
```

### 2026-10-16 шалгасан үр дүн

- Luna full pipeline exit0, source SHA256 өөрчлөгдөөгүй, preview artifact0. Delivery SHA256 `b3fc9348e4285109927cb24ec5cc5c4a91161cdf318b5da531108086aec8f82e`. Encoded validator0 errors/2 unsupported-extension warnings; decoded review0 errors/0 warnings.
- Шинэ үр дүнгийн 12 standard render, `model-work/luna-single-delivery-closeups-2026-10-16/` дотор pillow/rear-cushion close-up-ийг харав. Өмнөх урт хар цууралт эдгээр close-up дээр харагдаагүй; бүх өнцгийн баталгаа биш.
- Kitchen fixture:12 triangle хэвээр, socket matrix хэвээр, decoded хэмжээний зөрүү <0.01mm. Normal texture хадгалагдсан; KTX2 DFD normal166/UASTC, color163/ETC1S. Constant texture prune хийсний дараа texture үлдээгүй тохиолдлыг мөн дахин encode хийж шалгасан.
- `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`, Blender sofa guard exit0.
- Өргөтгөсөн related suite248 тестээс247 pass; өөрчлөгдөөгүй `tests/kitchen-room-outline.test.cjs`-ийн “main 2D plan exposes room points...” өмнөх failure1. Тусдаа single-delivery policy5 тест pass. Шинэ loading flow, retry/stale completion, camera motion, authored PBR болон asset retirement тестүүд pass.
- Browser inventory хоосон, IAB “Browser is not available” тул live browser GPU/FPS баталгаажуулалт хийгдээгүй. Live worker/R2 publish ажиллуулаагүй. Existing source/delivery/history-ийг энэ local шалгалт өөрчлөөгүй.
