# Kitchen planner: GLB ба SKP экспорт

Загварын нэр, хадгалах үйлдлүүдийн доор **GLB татах**, **SKP татах** товч нэмэгдсэн. Нэвтрээгүй хэрэглэгч мөн экспортолж болно. Файлд одоогийн 3D гарнитурын бүх mesh, өнгө, texture, хаалганы нээлттэй/хаалттай байрлал орно. Шал, grid, өрөөний туслах хана, сонголтын хүрээ орохгүй. Тавцангийн арын backsplash нь тавилгын хэсэг тул орно.

GLB-д шүүгээний их бие, ар, одоо дүрслэгдэж байгаа тавиур, хаалга, хүрээ, бариул, шургуулганы нүүр, тавцан, угаалтуур, цорго, плитка орно. Planner-д одоогоор загварчлаагүй нугас, шургуулганы зам, боолт зэрэг шинэ үйлдвэрлэлийн эд ангийг экспорт өөрөө зохиож нэмэхгүй.

## GLB — шууд ажиллана

Кодын багцыг төслийн үндсэн хавтаст хуулж build/deploy хийнэ. Шинэ npm dependency байхгүй. Exporter зөвхөн экспорт дарахад ачаалагдана. **GLB татах** нь браузер дээр ажилладаг; R2 эсвэл хөрвүүлэгч сервер шаардлагагүй. Texture-ууд GLB дотроо PNG хэлбэрээр хадгалагдана. Нэмэлт decimate хийгдэхгүй тул planner-ийн деталийг хадгална.

Эх координат, метр нэгж, эд ангийн шаталсан бүтцийг хадгалдаг. Тавилга бүхэлдээ нэг mesh болдоггүй. Экспортын snapshot тусдаа geometry/material-тай тул таталт хийх явцад гарнитурыг өөрчлөх, устгах нь эхэлсэн экспортыг эвдэхгүй.

## SKP — Vercel + тусдаа хөрвүүлэгч

**SKP хөрвүүлэгч одоогоор таны production сайтад холбогдоогүй.** Native SKP үүсгэх код болон Vercel-ийн API холболтыг багцад оруулсан. Шууд SKP таталтыг идэвхжүүлэхийн тулд SketchUp C SDK бүхий Windows серверийн HTTPS хаяг, нууц token-ийг тохируулна. Энэ ажилд шинэ сервер худалдаж авах, cloud service нээх, production env солих эсвэл deploy хийх үйлдэл хийгдээгүй.

```text
Браузер: тавилгын GLB snapshot
  → Vercel /api/kitchen/export/skp
  → Windows хөрвүүлэгч /convert
  → SketchUp C API → жинхэнэ .skp
  → браузерын таталт
```

Хөрвүүлэгч байхгүй үед SKP товч тайлбар харуулна. GLB файлыг .skp гэж нэрийг нь солиод өгөхгүй. Түр ашиглах боломж: SketchUp 2026-д **File → Import → GLTF Binary File (*.glb)**, дараа **File → Save As → .skp**. [SketchUp GLTF заавар](https://help.sketchup.com/en/sketchup/working-gltf-files).

### Windows хөрвүүлэгч бэлдэх

Windows x64, Python 3.11+, SketchUp 2025+ C SDK library хэрэгтэй (энэ компьютерт байгаа 2026 library дээр шалгасан). SDK-г өөрийн эрх, лицензийн дагуу суулгана; DLL, SketchUp програмыг кодын ZIP-д тараагаагүй. [Албан ёсны SDK](https://extensions.sketchup.com/en/developer_center/sketchup_sdk).

Серверт `scripts/sketchup` хавтсыг хуулж, төслийн үндсэн хавтсаас:

```powershell
python -m venv .venv-skp
.venv-skp/Scripts/python.exe -m pip install -r scripts/sketchup/requirements.txt

# Өөрийн суулгасан SDK library-ийн бүтэн замыг өгнө.
$env:SKETCHUP_API_PATH='C:/SketchUpSDK/SketchUpAPI.dll'
$env:SKP_CONVERTER_TOKEN='<дор-хаяж-32-тэмдэгт-санамсаргүй-нууц-token>'
$env:SKP_BIND='127.0.0.1'
$env:SKP_PORT='8789'
.venv-skp/Scripts/python.exe scripts/sketchup/server.py
```

SDK DLL-ийн хамаарах файлуудыг SDK-ийн зааврын дагуу хамт суулгана. Серверийг Windows service болгон ажиллуулж, HTTPS reverse proxy эсвэл өөрийн Cloudflare Tunnel-ээр `127.0.0.1:8789` рүү дамжуулна. Python HTTP серверийн портыг интернетэд шууд нээхгүй. Хөрвүүлэгчийн bearer token нь зөвхөн Vercel сервер болон Windows серверт байна. Token-ийг `NEXT_PUBLIC_` хувьсагч, repository, браузерт оруулахгүй. C API ажил бүр тусдаа process-ийн main thread дээр ажиллана; түр GLB/PNG/SKP нь хүсэлт дуусахад цэвэрлэгдэнэ.

### Vercel тохируулах

Project → Settings → Environment Variables:

```text
SKP_CONVERTER_URL=https://your-converter.example.com
SKP_CONVERTER_TOKEN=Windows-сервертэй-ижил-нууц-token
```

URL нь `/convert` төгсгөлгүй base URL байна. Тохируулсны дараа redeploy хийнэ. `GET /api/kitchen/export/skp` тохиргоо байвал `available: true` буцаана; серверийн ажиллагааг SKP таталтаар шалгана. Converter-ийн `/health` хаяг мөн bearer token шаарддаг. Локал development үед URL-д `http://127.0.0.1:8789` зөвшөөрнө; production HTTPS шаардлагатай.

Vercel API оролт/гаралтыг 4 MiB, native converter-ийг нэг зэрэг нэг ажил, 45 секунд, 200,000 triangle хүртэл хязгаарласан. Хязгаар хэтэрвэл алдаа тайлбарлаж, GLB-г ашиглаж болно. Эдгээр нь төслийн хязгаарууд. Үндсэн GLB браузерын экспортод энэ серверийн хязгаар үйлчлэхгүй.

### Дан CLI хөрвүүлэлт

```powershell
.venv-skp/Scripts/python.exe scripts/sketchup/convert.py kitchen.glb kitchen.skp --sdk 'C:/SketchUpSDK/SketchUpAPI.dll'
```

Зөвхөн энэ planner-ийн self-contained GLB-г хүлээн авна. External URL, compressed GLB, animation, skin, UV transform зэрэг ерөнхий импортын хувилбарууд дэмжигдэхгүй. Mетр/Y-up координатыг SketchUp-ийн inch/Z-up нэгжид хөрвүүлнэ. PNG-д base color tint-ийг bake хийж, roughness/metallic/opacity болон editable group-уудыг хадгална. Хоёр програмын гэрэлтүүлэг өөр учраас харагдах сүүдэр, гялбаа яг адил байх албагүй. [SketchUp C API ба нэгжүүд](https://extensions.sketchup.com/developers/sketchup_c_api/sketchup/index.html).

## Шалгасан үр дүн

Headless Edge дээр жинхэнэ товчоор татсан файлууд:

| Загвар | GLB byte | SKP byte | Mesh | SKP texture | Хүрээний зөрүү |
|---|---:|---:|---:|---:|---:|
| Шулуун, хаалттай | 403,088 | 882,771 | 109 | 39 | 0 мм |
| L баруун, нээлттэй | 427,096 | 922,232 | 111 | 41 | 0 мм |

GLB → Vercel-тэй ижил Next route → localhost converter → native SKP → браузерын таталт шалгагдсан. SKP-г SDK-аар буцааж нээж texture хэмжээ, материал, bounding box-ийг шалгасан. Live Vercel-ийн converter холболт хараахан тохируулагдаагүй.

```powershell
node --test tests/kitchen-export.test.cjs
npm test
npm run typecheck
npm run lint
npm run build
```

Тестүүд шалыг болон selection helper-ийг хасах, бүх тавилгын хэсгийг үлдээх, эх scene-ийн resource-ийг эвдэхгүй байх, файл/хэмжээ шалгах, хөрвүүлэгчгүй болон алдаатай хариуг боловсруулах, Origin хамгаалалтыг шалгана.
