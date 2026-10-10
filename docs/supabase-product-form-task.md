# Шинэ сессэд өгөх Supabase даалгавар

2026-10-10: Доорх migration серверт хэрэгжиж, шалгалтууд амжилттай болсон. GLB түүх, preview болон 24 цагийн source цэвэрлэгээний үр дүнг [шалгалтын тайлангаас](product-details-glb-verification.md) үзнэ үү. Доорх холболтын тухай тэмдэглэл нь өмнөх сессийн төлөв болно.

Төслийн зам: `C:\Users\HiTech\Desktop\ProjectN2`.
Supabase project ref: `gpdpaexkmuhxzknguicp`.

Холбогдсон Supabase plugin-ийг ашиглан бүтээгдэхүүний үзүүлэлт, нэмэлт ангиллын migration-ийг серверт хэрэгжүүлж шалга.

## Бэлэн өөрчлөлт

- CLI-аар үүсгэсэн, локал PostgreSQL дээр шалгасан migration-ийг серверийн history-тэй тааруулан `supabase/migrations/20261010114233_product_specifications_categories.sql` болгож нэрлэсэн (анхны version: `20261010110544`).
- `furniture_models.specifications` JSONB багана, хязгаартай текстийн validation нэмнэ.
- Ангиллыг 9-өөс 22 болгож `is_furniture_category` болон хүснэгтийн constraint-ийг шинэчилнэ.
- `save_furniture_product` нь одоогийн commerce болон нөөцийн CAS функцийг дуудаж, үзүүлэлтийг нэг transaction-д хадгална. Хуучин хүсэлт үзүүлэлт явуулаагүй бол өмнөх үзүүлэлтийг хадгална.
- RPC execute зөвхөн `service_role`; одоогийн RLS болон хүснэгтийн grants-ийг өргөжүүлэхгүй.
- Admin форм шинэ бүтээгдэхүүн үүсгэхдээ GLB сонгож нэг хадгалалтаар upload хийнэ. Upload алдаа гарвал checkpoint хадгалж дараагийн оролдлого PUT ашиглана.

## Хэрэгжүүлэх дараалал

1. Supabase skill уншиж plugin-ийн хэрэгслүүд харагдаж байгааг шалга. Төслийн ref-ийг баталгаажуул. Нууц түлхүүрийг чат, log руу хэвлэхгүй.
2. Live migration history болон schema шалга: `specifications` багана байхгүй эсэх, `save_furniture_product(jsonb,boolean,integer)`, `save_furniture_product_pre_phase5`, `is_furniture_category(text)` байгаа эсэх. Шинэ migration-ийг давхар хэрэгжүүлэхгүй.
3. `furniture_models` дээр одоогийн ангиллуудыг тоолж шинэ жагсаалтаас гадуур утга байгаа эсэхийг шалга. Constraint зөрчсөн хуучин өгөгдөл байвал шууд устгахгүй, шалтгааныг шийд.
4. Зөвхөн энэ шинэ migration-ийн SQL-ийг Supabase migration хэрэгслээр хэрэгжүүл. Бүх түүхэн migration-ийг `db push`-аар сохроор дахин явуулахгүй.
5. Дараах query-гаар schema болон permissions-ийг шалга. Дараа нь database advisors ажиллуул.
6. Түр transaction дотор `service_role`-оор бодит шинэ бүтээгдэхүүн үүсгэн `tiers`, `loadCapacity`, `assembly` хадгалж унш. Update, нөөцийн зөрчил, legacy metadata хадгалалт, буруу JSON rejection шалгаад transaction-ийг rollback хий. Бодит бараа үлдээхгүй.
7. Локал `/api/products` болон admin create/edit-ээр шинэ ангилал, үзүүлэлт хадгалаад буцаж харагдахыг шалга. GLB урсгалын browser шалгалт өмнөх сессэд mocked байсан; бодит R2 upload хийх бол жижиг fixture ашиглан pipeline дууссан эсэхийг шалгаж, үүсгэсэн тест өгөгдлийг хэрхэн цэвэрлэснээ тайлагна.
8. Боломжтой бол database TypeScript types-ийг дахин generate хийж `npm run typecheck`, холбогдох test-үүдийг ажиллуул. Одоо `furniture_models` Row/Insert/Update-д нэмсэн `specifications` typing байна.

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema='public' and table_name='furniture_models' and column_name='specifications';

select public.is_furniture_category('storage-shelf') as shelf,
       public.is_furniture_category('office-chair') as chair,
       public.is_furniture_category('unknown') as unknown;

select category, count(*) from public.furniture_models group by category order by category;

select has_function_privilege('anon','public.save_furniture_product(jsonb,boolean,integer)','execute') as anon_rpc,
       has_function_privilege('authenticated','public.save_furniture_product(jsonb,boolean,integer)','execute') as user_rpc,
       has_function_privilege('service_role','public.save_furniture_product(jsonb,boolean,integer)','execute') as server_rpc;
```

Хүлээгдэх үр дүн: JSONB багана NOT NULL, default `{}`; шинэ ангиллууд true, unknown false; RPC execute false/false/true.

## Өмнөх сессийн холболтын байдал

App-ийн Supabase REST хүсэлт HTTP 200 буцсан. Hosted MCP endpoint HTTP 401 буцсан нь OAuth шаардлагатай endpoint хүрч байгааг харуулсан; app холболт тасарсны нотолгоо биш. Хэрэглэгч plugin дээр Connect/Sign in хийснээ баталсан ч энэ сессийн хэрэгслүүдийн жагсаалтад Supabase database tools байгаагүй. CLI мөн access tokenгүй байсан. Live schema өөрчлөлт хийгээгүй.

Live `furniture_models?select=specifications&limit=0` read-only хүсэлт `42703` буцсан: шинэ багана серверт байхгүй. `/api/products?fresh=1` HTTP 200, 33 бүтээгдэхүүн буцсан. Бодит бүтээгдэхүүний хуудас HTTP 200, үзүүлэлтийн хүснэгттэй нээгдсэн.

Шалгалт: нийт 539 тест, lint, typecheck, 54 CSS stylesheet-ийн шалгалт, production build амжилттай. Desktop 1440px mouse hover, mobile 390px бодит touch event, ангиллаар солигдох талбарууд, браузер дахь GLB geometry preview, upload 503-ийн дараах POST → PUT дахин оролдлого шалгасан. Browser-ийн бүтээгдэхүүн/зураг/model write хүсэлтүүд mocked; live database болон R2 руу тест өгөгдөл бичээгүй.

`.mcp.json` project-scoped HTTP endpoint-той. Codex CLI-ийн тохиргоо өөр: [Supabase-ийн албан ёсны MCP заавар](https://supabase.com/docs/guides/ai-tools/mcp). Plugin шинэ сессэд ажиллаж байвал нэмэлт CLI OAuth холболт үүсгэх шаардлагагүй.

Холбогдох tests: `tests/product-editor-workflow.test.cjs`, `tests/marketplace-product-commerce.test.cjs`.
