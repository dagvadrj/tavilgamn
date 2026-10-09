# EmbeddingGemma 2 — tavilga.mn серверийн worker судалгаа

Судалсан огноо: 2026-10-09. Энэ файл нь хэрэгжүүлэлтийн санал; model татах, inference benchmark, серверт install/deploy, DB migration хийгээгүй. Хэрэглэгч iTools эсвэл Datacom сонгохоор төлөвлөсөн; яг авах багц, CPU/RAM/GPU одоогоор тодорхойгүй.

## Дүгнэлт

**Болно.** Linux VPS/container дээр байнгын Python embedding service болон background indexing worker ажиллуулах нь манай Next.js + Supabase төсөлтэй нийцнэ. Эхний хувилбарыг текстийн semantic search-д зориулж GPUгүй турших; зурагтай төстэй тавилга хайлтыг дараа нь үнэлэх саналтай. Энэ бол кодын архитектур ба албан ёсны inference support-оос хийсэн дүгнэлт, манай серверт хэмжсэн үр дүн биш.

Хайлт хийж буй хэрэглэгчид зөвхөн background worker хангалтгүй. Барааны vector-уудыг урьдчилан бэлдсэн ч **шинэ query-ийн embedding** шаардлагатай. Тиймээс worker болон query inference-ийг хоёр урсгал болгон зохион байгуулах хэрэгтэй.

## Загварын баталгаажсан мэдээлэл

- Зөв model ID: `google/embeddinggemma-2`. Google-ийн launch огноо **2026-10-06**. Text, image, audio, video дэмждэг; full model 740M параметр, Apache 2.0 лицензтэй. Google-ийн мэдээлсэн ~191MB text memory нь quantized Pixel төхөөрөмжийн active weights хэмжилт; Python серверийн нийт RAM гэж үзэхгүй. [Google launch](https://blog.google/innovation-and-ai/technology/developers-tools/embeddinggemma-2/).
- Text-only 270M, text+image 440M; unused encoders-ийг салгаж болно. Context 8,192 token; vector 768 dimension, MRL-ээр 512/256/128 болгон богиносгож болно. Query/document ижил dimension, богиносгосны дараа normalization шаардлагатай. 100+ language дэмжлэг нь Монгол тавилгын хайлтын чанарын баталгаа биш. [Google model card](https://huggingface.co/google/embeddinggemma-2).
- CPU/GPU inference болон Python Sentence Transformers-ийн жишээ бий. Text-only loading-д `config_kwargs={"vision_config": None, "audio_config": None}`; CPU-д `float32`, тохирох GPU-д `bfloat16`; `float16` ашиглахгүй. Search query болон document-д ялгаатай task prompt хэрэглэнэ. [Google inference guide](https://ai.google.dev/gemma/docs/embeddinggemma/inference-embeddinggemma-with-sentence-transformers).
- TEI-ийн одоогийн supported-model жагсаалтад өмнөх `embeddinggemma-300m` бий; **EmbeddingGemma 2-ийн TEI support-ийг энэ судалгаагаар батлаагүй**. Хуучин model-ийн Docker command-д ID-г солиод шууд ажиллана гэж үзэхгүй. Эхний хэрэгжүүлэлтэд албан ёсоор жишээтэй Python/Sentence Transformers зам сонгох. [TEI supported models](https://github.com/huggingface/text-embeddings-inference/blob/main/docs/source/en/supported_models.md).

## Манай кодтой нийцэх нь

- `scripts/models/worker.mjs` нь GLB processing/export, R2 болон Supabase-тэй холбоотой Node worker. Embedding model-ийг энэ worker-ийн GLB job дотор ачаалах саналгүй: model-ийн dependency, restart, CPU нөөц, queue тусдаа байх хэрэгтэй.
- `src/lib/productSearch.ts` одоогоор нэр/тайлбар/ангилал дээр alias болон substring хайдаг. Semantic query ranking, vector хадгалалт source/schema хайлтад олдсонгүй.
- `src/app/api/products/route.ts` бүх каталогийг буцаадаг. Semantic search-д тусдаа endpoint нэмээд одоогийн keyword хайлтыг fallback болгох саналтай.
- Өмнөх аудитын хэмжилтээр каталог 32 бараатай. Энэ хэмжээнд keyword хайлт хямд, хурдан хэвээр. Embeddings-ийн зорилго нь “жижиг өрөөнд тохирох цайвар буйдан”, “ажлын өрөөнд авсаархан ширээ” гэх утгын хайлт, цаашдын зурагт хайлтын чанар; Next.js bundle, GLB download, payment blocker-ийг шийдэхгүй.

## Санал болгож буй архитектур

1. **Бараа нэмэх/өөрчлөх:** Supabase transaction/outbox-д indexing job бүртгэнэ. Контентын hash өөрчлөгдөөгүй бол дахин embed хийхгүй. Public-аас archive хийхэд search eligibility шууд өөрчлөгдөнө.
2. **Index worker:** job claim → approved current product metadata унших → embedding service рүү batch → Supabase vector upsert → commit/ack. Model resident тул job бүрд дахин download/load хийхгүй.
3. **Query path:** браузер → Next.js `/api/search` → хувийн embedding service → Supabase similarity query → keyword ranking-тай нэгтгэх → live public product projection буцаах.
4. **Fallback:** inference timeout/service down үед одоогийн keyword/alias хайлт үргэлжилнэ. Service unavailable нь каталог/checkout-ийг хаахгүй.

Inference service нь model-ийг startup дээр нэг удаа ачаална. Эхний CPU хувилбарт **1 process / 1 model instance**, bounded inference concurrency, query-д priority, indexing batch-ийг жижиг байлгах. Олон Uvicorn worker process нь model memory-г process бүрд давтан хэрэглэж болзошгүй; benchmark-гүйгээр process тоог нэмэхгүй.

Worker зөвхөн batch indexing хийж өдөрт нэг удаа унтраад байж болно. Харин хэрэглэгчийн query inference-д low latency хүсвэл service warm хэвээр байна. Хоёрыг нэг host/model process дээр queue priority-тай эхлүүлж болох ч traffic ихэсвэл query service болон offline indexing capacity-г тусад нь өргөжүүлнэ.

## Нөөцийн урьдчилсан sizing

Дараах нь **миний инженерийн эхлэх санал**, үйлдвэрлэгчийн minimum requirement эсвэл benchmark биш. Input length, batch size, dtype, library, зэрэг хүсэлтийн тоогоор бодит хэрэглээ өөрчлөгдөнө.

- Dedicated text-only pilot: **2–4 vCPU, 4GB RAM**, GPUгүй. Зөвхөн бага traffic болон жижиг batch дээр туршина.
- Next.js + embedding + одоогийн GLB worker нэг VPS-д байрлах бол **4 vCPU, 8GB RAM эсвэл түүнээс дээш**-ээс туршиж, process/container бүрд CPU/RAM limit тавих. GLB processing peak болон query latency зэрэг өсөхийг хэмжих.
- Text+image pilot: **8GB RAM ба түүнээс дээш**-ээс туршиж эхлэх; зураг/batch/input хэмжээ болон CPU throughput-ийг хэмжих. GPU шаардлагатай эсэхийг ачааллын шалгалтаар шийдэх.
- 270M text weights-ийг float32 гэж энгийнээр тооцвол ~1.08GB decimal; 440M нь ~1.76GB; full 740M нь ~2.96GB. Энэ нь зөвхөн параметрийн арифметик тооцоо: activations, tokenizer, Python/PyTorch, model loading peak болон OS ороогүй.
- Model cache-д persistent volume; restart дээр weights дахин татахгүй. Богино каталог/query-д 8K context бүхэлд нь ашиглах шаардлагагүй; pilot-д 512/1024 token cap-ийн чанар/нөөцийг харьцуулах.
- GPUгүй ажиллах нь баталгаажсан боломж. Харин latency, requests/sec, peak RAM-ийн тоог манай сервер дээр model ажиллуулахгүйгээр амлахгүй.

Vercel дээр Next.js байж болно; inference/indexing-ийг тусдаа VPS/container service-д байрлуулах саналтай. Functions нь invocation duration болон memory limit-тэй тул байнгын polling loop + resident model worker-д тохиромжтой runtime гэж үзэхгүй. [Vercel Functions limits](https://vercel.com/docs/functions/limitations).

## Supabase vector ба queue

Эхний багцад `product_embeddings` гэсэн тусдаа хүснэгт: product/model ID, model revision, dimension, encoder configuration, prompt version, content hash, vector, indexed_at. `vector(768)`-аар baseline эхлүүлээд 256 dimension-ийн ranking-ийг бодит test set дээр харьцуулах. Model/prompt/config солигдвол reindex version үүсгэх; хуучин ба шинэ model-ийн vector-ийг хольж score хийхгүй. Supabase нь `pgvector` vector column, cosine/inner-product similarity дэмждэг. [Supabase vector columns](https://supabase.com/docs/guides/ai/vector-columns).

32 бараанд exact similarity scan хангалттай байх саналтай; HNSW index-ийг өсөлт/хэмжилт шаардсан үед нэмэх. Keyword болон vector ranking-ийг RRF зэрэг ranking fusion-аар нэгтгэж болно. Өнгө/үнэ/өргөн/барааны ангилал/үйлчлэх бүсийн шаардлагыг semantic score-д найдахгүй, structured filter болгон барина. [Supabase hybrid search](https://supabase.com/docs/guides/ai/hybrid-search).

Supabase Queues/pgmq ашиглаж болох тул эхний хувилбарт Redis нэмэх шаардлагагүй. Гэхдээ visibility timeout/retry байгаа учраас job execution-ийг өөрсдөө idempotent болгоно: `model_revision + prompt_version + content_hash` key, retry backoff, lease expiry, attempts/dead-letter, outdated hash-ийн result-ийг publish хийхгүй. [Supabase Queues](https://supabase.com/docs/guides/queues).

Нэр, тайлбар, ангилал, материал, хэмжээ зэрэг батлагдсан бүтээгдэхүүний контент embed хийнэ. Stock болон үнэ байнга өөрчлөгддөг тул эхний багцад эдгээрийг live filter/metadata болгон уншиж, өөрчлөх болгонд unnecessarily reembed хийхээс зайлсхийх.

## Монгол хайлтын туршилтын шалгуур

Чанарын тест заавал хэрэгтэй. Кирилл, латин, холимог үг, typo, Монгол худалдааны нэршил дээр 50–100 query болон зөв product жагсаалт бэлдэх. Одоогийн alias хайлттай Recall@5/nDCG@5, no-result болон буруу category-ийн үр дүнг харьцуулах.

Жишээ: “жижиг өрөөний буйдан”, “buidan”, “цагаан шкаф”, “2 метрээс нарийн ор”, “ажлын өрөөний ширээ”. Сүүлийн хэмжээсийн нөхцөлийг embedding өөрөө найдвартай тоон filter болгож өгнө гэж үзэхгүй. Нэг ерөнхий cosine threshold-ийг Google-ийн similarity жишээнээс шууд хуулж тавихгүй; өөрийн data дээр тохируулна.

Pilot acceptance санал:

- Startup/weights download, warm/cold encode, RSS/peak RAM, CPU, p50/p95, batch 1/4/8, query+index concurrent ачааллыг хэмжсэн байх.
- Query-ийн p95 нэмэлт хугацааны зорилтыг эхэнд нь тогтоох; жишээ нь warm inference+network-д 300ms зорилт тавьж хэмжих. **Энэ нь таамагласан гүйцэтгэл биш, туршилтын зорилт**.
- Stock/price/archive/merchant eligibility live фильтртэй; stale embedding буруу private/archived product харуулахгүй.
- Service down, OOM/restart, duplicate/outdated job үед keyword fallback болон идемпотент queue ажиллана.
- Дараах rollout: зөвхөн admin pilot → feature flag → хязгаарлагдмал хэрэглэгч → default search. Fallback switch бэлэн.

## Хэрэгжүүлэх бол нэмэх/өөрчлөх файлууд

Эдгээр файл **одоогоор үүсээгүй, санал**:

- `services/embeddings/app.py` — private inference API, singleton model, bounded queue, health/readiness.
- `services/embeddings/worker.py` — durable indexing jobs, retries/hash/version шалгалт.
- `services/embeddings/requirements.txt`, `Dockerfile` — smoke test хийсэн dependency versions ба model revision-ийг pin хийх.
- `supabase/migrations/<timestamp>_product_embeddings.sql` — vector schema, queue/outbox, search RPC, ACL/RLS.
- `src/lib/semanticSearchServer.ts` — service timeout/cache/fallback, query vector ба ranking.
- `src/app/api/search/route.ts` — public query validation, rate limit, live filters.
- `src/components/ProductSearch.tsx`, `src/components/CatalogProducts.tsx`, `src/lib/productSearch.ts` — query debounce/abort, шинэ ranking ба keyword fallback.
- `scripts/search/evaluate.*` — Монгол query test set, quality/latency evaluation.
- `.env.example`, production runbook — server-only service URL/key, feature flag; browser-д service/DB secret өгөхгүй.

Internal API-г хувийн network/localhost + service authentication-тай ажиллуулах; гаднаас хязгааргүй query/batch/дурын URL таталт нээхгүй. Image phase-д product-ийн зөвшөөрөгдсөн storage asset-ийг л авах.

## 14 хоногийн release-д оруулах санал

Text-only pilot ойролцоогоор **1–2 өдөр**, production integration/queue/fallback/evaluation **нэмэлт 1–3 өдөр** гэсэн урьдчилсан инженерийн estimate. Шинэ model-ийн library compatibility, hardware, Монгол ranking-ээс шалтгаалан өсөж болно. Зураг/audio/video интеграц үүнд ороогүй.

Одоогийн release төлөвлөгөөнд payment/auth/каталог blocker шийдэгдээгүй тул semantic search-ийг core publish-ийн dependency болгох саналгүй. Worker/service-ийг тусдаа feature flag-тай бэлтгэж, quality/latency шалгалт давбал 10 хоногийн дотор идэвхжүүлж болно. Серверийн үзүүлэлт ирсний дараа dedicated эсвэл co-located байршуулалт, CPU/RAM budget, query throughput-ийн benchmark төлөвлөгөөг эцэслэнэ.

## iTools / Datacom — хэрэглэгчийн hosting сонголт

2026-10-09-нд албан ёсны нээлттэй хуудсуудыг шалгасан. Нийтэлсэн үнэ нь эцсийн нэхэмжлэл биш; НӨАТ, setup, backup, бодит нөөцийн нөхцөлийг үнийн саналтай тулгана. GPU олдоно гэсэн мэдээлэл батлагдаагүй; эхний хувилбар CPU text-only.

- **Datacom, Монголд байрлах VPS SSD2:** 4 vCPU, 8GB RAM, 160GB SSD, 1 IP; эхлэх үнэ **198,000₮/сар**. **SSD3:** 6 vCPU, 16GB RAM, 320GB SSD; **374,000₮/сар**. Энэ нь гадаад/Сингапур багцын бус, дотоод VPS-ийн захиалгын хуудсан дээрх үнэ. [Datacom дотоод VPS](https://manage.datacom.mn/store/cloud).
- **iTools, захиалгын порталын VPS 4 Enterprise SSD:** 4 CPU core, 8GB RAM, 120GB SSD; эхлэх үнэ **440,000₮/сар + 30,000₮ суурилуулалт**. Үүнээс тусдаа Cloud.mn-ийн шинэ үнийн санал авч харьцуулах шаардлагатай; portal VPS үнийг iTools-ийн бүх cloud бүтээгдэхүүний үнэ гэж үзэхгүй. [iTools VPS](https://secure.itools.mn/index.php/store/virtual-server-tureeslekh-vps).
- **iTools Node.js hosting:** 2 core, 6GB RAM, 25GB NVMe, сарын багц **21,000₮/сар, НӨАТгүй**. Энэ хуудсанд persistent Python/PyTorch inference, root/Docker эрхийг баталгаажуулаагүй. Веб аппыг энд, embedding worker-ийг тусдаа VPS-д байршуулах хувилбарыг Next.js runtime боломжийг нягталсны дараа авч үзэж болно. [iTools Node.js hosting](https://itools.mn/mn/product/hosting).
- **Cloud.mn:** виртуал серверийн нөөцийг өсгөх/бууруулах, ашигласан цагаар төлөх боломж нийтэлсэн; нээлттэй текстээс яг 4 vCPU/8GB багцын үнийг тогтоогоогүй. [Cloud.mn](https://cloud.mn/).

**Одоогийн санал:** нийтэлсэн багц/үнийн хүрээнд Datacom SSD2 нь жижиг text-only pilot-ийн эхний candidate. Энэ нь provider uptime/CPU хурдын чансаа биш. Нэг host дээр Next.js, embedding inference, GLB processing зэрэг ажиллуулах шаардлагатай бол SSD3 эсвэл ижил 16GB cloud үнийн санал авч, ачааллын туршилтаар эцэслэх. 8GB дээр GLB job-ийн CPU/RAM peak, Next build, indexing-ийг хэрэглэгчийн query-тэй хяналтгүй давхцуулахгүй; боломжтой бол build-ийг CI-д гүйцэтгэнэ.

Захиалгын өмнө provider-оор баталгаажуулах техникийн нөхцөл: Linux Ubuntu LTS сонголт ба root/SSH; Docker/systemd-ийн байнгын Python service/worker зөвшөөрөл; CPU model/SIMD support, shared/dedicated CPU ба удаан CPU ачааллын хязгаар; баталгаат RAM, snapshot/backup, upgrade нөхцөл; Hugging Face weights болон Supabase/R2 рүү outbound холболт. Монголд байрлах серверээс одоогийн гадаад DB/storage рүү latency-г pilot дээр хэмжинэ. Энэ судалгааны хүрээнд provider-той холбоо барих, сагсанд нэмэх, худалдан авах үйлдэл хийгээгүй.
