// Offline documentation derived from route exports and the checked-in schema.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const check = process.argv.includes('--check');
const source = relative => ts.createSourceFile(relative, fs.readFileSync(path.join(root, relative), 'utf8'), ts.ScriptTarget.Latest, true);
const name = node => node?.name?.getText().replaceAll('"', '') ?? '';
const property = (node, key) => node.members.find(item => name(item) === key)?.type;
const walk = directory => fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(`${directory}/${entry.name}`) : entry.name === 'route.ts' ? [`${directory}/${entry.name}`] : []);
function save(relative, value) {
  if (check) {
    if (!fs.existsSync(path.join(root, relative)) || fs.readFileSync(path.join(root, relative), 'utf8') !== value) {
      console.error(`Reference is stale: ${relative}`); process.exitCode = 1;
    }
  } else fs.writeFileSync(path.join(root, relative), value);
}

const meanings = {
  commerce_order_events: 'Захиалгын payment/fulfillment/cancellation/refund үйл явдлын append-only audit. order_id → orders; actor_id → profiles. Санхүүгийн түүхийг засаж устгахгүй.',
  contact_messages: 'Contact API-аас үүсэх хувийн inbox. Зөвхөн admin API-аар уншина.',
  conversations: 'Нөөц messaging бүтэц; одоогийн application API ашигладаггүй.',
  furniture_models: 'Бүтээгдэхүүний нэр, үнэ, бүхэл stock, хэмжээс, GLB зам болон store membership-ийн үндсэн эх үүсвэр. dimensions_* нь метр; store_ids нь UUID массив. Promotion нь үндсэн үнээс их reference price-тэй байна.',
  kitchen_design_media: 'Marketplace version-ийн thumbnail/render media; нийтэд зөвхөн approved published version-ийн зөвшөөрөгдсөн media гарна.',
  kitchen_design_reviews: 'Admin review-ийн түүх, тайлбар; public reader-д өгөхгүй.',
  kitchen_design_versions: 'Marketplace geometry/material snapshot. Submitted/published хувилбарыг editor project шинэчилж өөрчлөхгүй.',
  kitchen_designs: 'Merchant listing болон approved published version pointer. Дэлгүүрийн active/eligible байдал public visibility-д хамаарна.',
  kitchen_garnitures: 'Хэрэглэгчийн account kitchen project. user_id + id ownership; revision compare-and-swap хадгалалт.',
  kitchen_garniture_versions: 'Kitchen editor-ийн immutable revision snapshot. Restore нь редакторт ачаалж, хадгалахад шинэ revision үүсгэнэ.',
  kitchen_marketplace_audit: 'Marketplace ажиллагааны private append-only audit; public/client grants өгөхгүй.',
  kitchen_module_variants: 'Module → furniture model binding, opening, door/drawer, default болон design-code configuration. Нэрээр хэмжээс таахгүй.',
  kitchen_modules: 'Cabinet type/code болон W/H/D footprint. *_mm нь бүхэл миллиметр. Module болон GLB бодит хэмжээсийг тусад нь баталгаажуулна.',
  kitchen_quote_requests: 'Хэрэглэгчийн quote болон immutable project/version snapshot. Merchant зөвхөн өөр eligible store-д ирснийг уншиж хариулна.',
  kitchen_render_jobs: 'AI render request/claim/result. Paid generate-д admin-ийн explicit cost approval шаардлагатай.',
  kitchen_render_policy: 'Дэлгүүрийн render allowance ба operator policy; UI quota нь зөвшөөрөл биш.',
  material_definitions: 'PBR өнгө/roughness/metalness/texture map. Материалын code нь дэлгэцийн palette-аас тусдаа authored data.',
  merchant_order_fulfillments: 'Order-ийн merchant/commission/line snapshot болон fulfillment status. Ownerless platform store-д хуурамч merchant row үүсгэхгүй.',
  merchant_stores: 'Дэлгүүрийн authoritative profile. owner_id NULL бол platform directory; merchant эрх олгож буй утга биш.',
  messages: 'Нөөц messaging бүтэц; одоогийн application API ашигладаггүй.',
  model_assets: 'Server-only source/delivery/preview/standard/thumbnail version ledger. storage_path unique; pending/available/retired/deleting/deleted. Source/private export нь public file API-аар гарахгүй.',
  order_cancellations: 'Customer cancellation request болон admin decision/refund reference. Provider refund-ийг энэ row дангаараа гүйцэтгэхгүй; reference/amount баталгаажуулна.',
  order_payments: 'Private provider invoice/callback token/settlement state. Callback нь browser redirect-ээр paid болдоггүй.',
  orders: 'Server-priced immutable item/delivery/financial snapshot, idempotency key ба stock reservation. Currency MNT; клиент subtotal-д итгэхгүй.',
  product_media_assets: 'Cloudinary upload intent/result ledger: uploading/ready/attached/retained/failed/deleting/deleted. URL/public_id unique; historical references хадгална.',
  product_media_refs: 'Product → media asset reference. Composite key model_id + asset_id; cleanup нь reference-тэй media устгахгүй.',
  products_legacy_backup: 'Өмнөх catalog migration-ийн архив; runtime query ашигладаггүй. Recovery зорилгоор хадгална.',
  profiles: 'Fresh end-user role. Auth identity нь auth.users; browser metadata эсвэл button visibility-ээр role тогтоохгүй.',
  user_notifications: 'User-owned persisted notification, review/merchant үйл явдлын link болон read state.',
  room_projects: 'Owner-private room project; CAS revision, explicit local import identity, reversible archive.',
  room_project_versions: 'Immutable room/kitchen-import snapshot; operation UUID idempotency, owner/project/revision key.',
  api_rate_limit_buckets: 'Private atomic HMAC quota counters; no raw IP/contact data.',
};
const ast = source('src/lib/supabase/database.types.ts');
const database = ast.statements.find(node => ts.isTypeAliasDeclaration(node) && name(node) === 'Database').type;
const tables = property(property(database, 'public'), 'Tables');
const schemaNames = new Set(tables.members.map(name));
let dictionary = '# Database table / data dictionary\n\n2026-10-03: checked-in `src/lib/supabase/database.types.ts` snapshot болон Phase 6/8 SQL contract-оос үүсгэв. Энэ нь live schema-г шинээр татсан баталгаа биш. Phase 6/8 fields/tables нь migration overlays; deployment дээр хэрэгжүүлээд generated types-ийг шинэчилнэ.\n\n`npm run docs:generate` дахин үүсгэнэ; `npm run docs:check` өөрчлөлттэй эсэхийг шалгана. Migration → generated types → dictionary гэсэн дарааллаар шинэчилнэ. Domain meaning-ийн тайлбар нь generator дахь `meanings` map-д байна.\n\n## Нэгж, JSON, permission\n\n- `number` нь SQL numeric/integer/bigint-ийн generated TS хэлбэр; яг SQL constraint/default-ийг migrations-оос шалгана. Үнэ MNT; safe-integer validation серверт байна.\n- Product/room хэмжээс метр; kitchen module/editor хэмжээс миллиметр; rotation радиан. mm↔m хөрвүүлэлт scene boundary дээр хийнэ.\n- `Json` нь JSONB wire type; kitchenAssembly/orderValidation зэрэг validator domain бүтцийг шалгана.\n- Insert дээр optional гэдэг нь generated contract дахь `?`; NULL гэсэн утга биш. NULL зөвшөөрөх эсэхийг Row type-ийн `| null` харуулна.\n- Foreign key-ууд generated Relationships-оос гарна. store_ids semantic membership нь тусдаа relation table биш. Primary/unique/check/default/RLS-ийн бүрэн эх сурвалж нь SQL migrations.\n- auth.users, session, storage.objects нь Supabase managed schema; энэ public dictionary-д багтаагүй. Room designs/cart/wishlist browser data нь санхүү, эрхийн authoritative эх үүсвэр биш.\n- Үндсэн relation: profiles → stores/projects/orders; kitchen_modules → variants → furniture_models; orders → payments/fulfillments/cancellations/events; furniture_models → model_assets/media_refs → media_assets. Public projection нь private row-ийг бүхэлд нь буцаахгүй.\n\n';
for (const table of tables.members) {
  const tableName = name(table), row = property(table.type, 'Row'), insert = property(table.type, 'Insert');
  if (!meanings[tableName]) throw new Error(`Add table meaning for ${tableName}`);
  dictionary += `## ${tableName}\n\n${meanings[tableName]}\n\n| Column | Row type | Insert |\n| --- | --- | --- |\n`;
  for (const column of row.members) {
    const insertColumn = insert.members.find(item => name(item) === name(column));
    dictionary += `| \`${name(column)}\` | \`${column.type.getText(ast).replaceAll('|', '\\|').replace(/\s+/g, ' ')}\` | ${insertColumn?.questionToken ? 'Optional' : 'Required'} |\n`;
  }
  if (['model_assets', 'product_media_assets'].includes(tableName) && !row.members.some(column => name(column) === 'cleanup_claim')) dictionary += '| `cleanup_claim` | `string \\| null` UUID — Phase 6 | Migration overlay |\n| `cleanup_claimed_at` | `string \\| null` timestamp — Phase 6 | Migration overlay |\n';
  dictionary += '\n';
  const relationships = property(table.type, 'Relationships');
  if (ts.isTupleTypeNode(relationships)) for (const relationship of relationships.elements) {
    const text = key => property(relationship, key)?.getText(ast).replace(/\s+/g, ' ');
    dictionary += `- FK ${text('columns')} → ${text('referencedRelation')} ${text('referencedColumns')} (${text('foreignKeyName')}).\n`;
  }
  dictionary += '\n';
}
if (!schemaNames.has('api_rate_limit_buckets')) dictionary += '## api_rate_limit_buckets — Phase 6 migration overlay\n\nPrivate atomic quota counter; generated schema snapshot-д хараахан ороогүй. Raw IP, email хадгалахгүй.\n\n| Column | SQL / meaning |\n| --- | --- |\n| scope | text, 1–64 тэмдэгт operation scope |\n| identity_hash | text, 64 lowercase hex HMAC |\n| window_start | timestamptz, fixed window эхлэл |\n| requests | integer > 0, atomic count |\n| expires_at | timestamptz, expiry/prune index |\n\nPrimary key `(scope, identity_hash, window_start)`. RLS enabled; anon/authenticated/public grants revoked; service_role CRUD only. `consume_api_rate_limit` / `prune_api_rate_limits` service-only.';
dictionary += '\n## Migration ба historical snapshot дүрэм\n\nPhase 6/8 `database.ts` нь зөвхөн additive room table/RPC contract болон SQL NULL аргументын нарийн override хийдэг. Generated бүх RPC/type contract-ийг дур мэдэн өргөсгөхгүй. Cleanup claim/finish/candidates/readiness функцүүд service-only; late completion нь deleting/deleted asset-ийг active болгохгүй.\n\nOrders, quote, published version, room-д импортлосон kitchen snapshot болон retired asset нь түүхэн хувилбар. Одоогийн product/module-ийн хэмжээ, үнэ, image өөрчлөхөд тэдгээрийг rewrite хийхгүй. Database backup нь R2/Cloudinary object bytes-ийг сэргээхгүй. [Role matrix](role-permissions.md), [API](api-reference.md), [backup/restore](operations-runbook.md)-г хамт ашиглана.\n';
if (!schemaNames.has('room_projects')) dictionary += `
## room_projects — Phase 8 migration overlay

Existing generated snapshot-д ороогүй; SQL contract: [20261003050000_room_cloud_projects.sql](../supabase/migrations/20261003050000_room_cloud_projects.sql).

| Column | SQL type / meaning |
| --- | --- |
| user_id | uuid NOT NULL, auth.users FK; API-ийн verified actor |
| id | uuid NOT NULL, owner/project composite key |
| name | text NOT NULL, trimmed 1–100 chars |
| document | jsonb NOT NULL, schemaVersion=1; design geometry м, nested kitchen мм; ≤1 MiB SQL |
| revision | integer NOT NULL >0, mandatory compare-and-swap |
| room_count | integer NOT NULL 1–12, bounded summary |
| piece_count | integer NOT NULL 0–500, all rooms total |
| import_key | text NULL, 1–160; UNIQUE(user_id,import_key), explicit browser import dedup |
| archived_at | timestamptz NULL; archive does not delete history |
| created_at / updated_at | timestamptz NOT NULL, server timestamps |

RLS owner SELECT; anon denied. authenticated/service_role have SELECT only. Service-only SECURITY DEFINER RPC performs locked actor-bound writes, never a public client table write.
`;
if (!schemaNames.has('room_project_versions')) dictionary += `
## room_project_versions — Phase 8 migration overlay

| Column | SQL type / meaning |
| --- | --- |
| user_id / project_id | uuid NOT NULL; composite FK room_projects, deletion only with auth account/controlled admin removal |
| revision | integer NOT NULL >0; primary key (user_id,project_id,revision) |
| operation_id | uuid NOT NULL; UNIQUE(user_id,operation_id), lost-acknowledgement retries return acknowledged snapshot |
| name | text NOT NULL 1–100 |
| document | jsonb NOT NULL ≤1 MiB, immutable parsed snapshot |
| created_at | timestamptz NOT NULL |

Only owner/service SELECT grants. RPC snapshots insert; direct service/browser UPDATE/DELETE denied. Restore loads old editor state and saves a new room revision; archived history remains an asset reference in [cleanup guard](../supabase/migrations/20261003051000_room_cleanup_references.sql). Regenerate live types after applying migrations and remove the matching narrow database.ts overlays.
`;
save('docs/data-dictionary.md', dictionary);

const descriptions = {
  analytics: 'Analytics summary', commerce: 'Commerce health/reconciliation', images: 'Cloudinary image upload',
  'kitchen-designs': 'Marketplace listing/version management', 'kitchen-material-textures': 'Material texture upload',
  'kitchen-materials': 'PBR material catalog', 'kitchen-modules': 'Module/variant catalog', generate: 'Explicit approved paid render generation',
  merchants: 'Merchant role/settings', messages: 'Private contact inbox', 'model-assets': 'Versioned asset history',
  download: 'Private model download', export: 'Model standard export queue/status', requests: 'Merchant 3D model requests', status: 'Processing status',
  'upload-complete': 'Validate/finalize tracked source upload', 'upload-url': 'Create tracked R2 PUT intent', cancellation: 'Admin cancellation/refund decision',
  'confirm-transfer': 'Bank-transfer reconciliation', fulfillment: 'Platform fulfillment transition', orders: 'Order read/create or merchant fulfillment',
  products: 'Product catalog / authorized mutations', stores: 'Store directory', users: 'Profile role administration',
  contact: 'Contact form submission', 'storage-cleanup': 'Authorized dry-run/apply cron', live: 'Process liveness', ready: 'Phase 6/8 database RPC and grant readiness',
  skp: 'Optional GLB→SKP converter availability/export', clone: 'Clone a published kitchen snapshot into own project', quotes: 'Create customer kitchen quote',
  'kitchen-quotes': 'Kitchen quote history/merchant response', cancel: 'Cancel own order/render request under state rules',
  thumbnail: 'Persist own kitchen thumbnail', versions: 'Own immutable kitchen versions', kitchens: 'Own account kitchen projects',
  media: 'Merchant version media upload', renders: 'Merchant render request/allowance', project: 'Read-only merchant quote project snapshot',
  notifications: 'Own merchant notifications', store: 'Own active merchant store', 'model-metrics': 'Sampled model/canvas diagnostics',
  models: 'Public GLB model registry; admin archived view', upload: 'Admin model upload', payment: 'Own order payment create/check',
  quote: 'Server-priced cart quote', methods: 'Configured payment methods', notify: 'Verified SocialPay notification', featured: 'Public featured stores',
  telemetry: 'Sampled same-origin navigation/Web Vitals ingestion',
  'room-projects': 'Own bounded room summaries and idempotent CAS saves',
};
const routeDescriptions = {
  '/api/room-projects/[id]': 'Own room document read and reversible archive/restore',
  '/api/room-projects/[id]/versions': 'Own room version list or immutable document read',
  '/api/kitchens/[id]': 'Read one own kitchen project without loading the whole library',
  '/api/admin/orders': 'Admin order listing and filters',
  '/api/merchant/orders': 'Own store order listing and fulfillment transitions',
  '/api/orders': 'Own order listing and idempotent order creation',
  '/api/orders/[id]': 'Own order details, payment and fulfillment projection',
  '/api/orders/[id]/cancel': 'Request cancellation of an eligible own order',
  '/api/kitchen-render-jobs/[id]/cancel': 'Cancel an eligible own queued render job',
  '/api/merchant/kitchen-designs/[id]': 'Edit own listing snapshot and transition review/publication state',
  '/api/merchant/products/[id]': 'Edit own store product with stock/ownership guards',
  '/api/models/[id]': 'Archive or restore a model through the authorized state RPC',
  '/api/models/files/[id]/[...filename]': 'Controlled image/GLB delivery',
  '/api/payments/callback/[method]/[id]': 'Verify provider payment and settle the matching order idempotently',
};
function guardsFor(ast, method, definitions, visited = new Set()) {
  if (visited.has(method)) return [];
  visited.add(method);
  const node = definitions.get(method); if (!node) return [];
  const guards = [...new Set(node.getText(ast).match(/require(?:User|Admin|Merchant)/g) || [])];
  const visit = child => {
    if (ts.isCallExpression(child) && ts.isIdentifier(child.expression) && definitions.has(child.expression.text)) guards.push(...guardsFor(ast, child.expression.text, definitions, visited));
    if (ts.isIdentifier(child) && definitions.has(child.text) && child.text !== method) guards.push(...guardsFor(ast, child.text, definitions, visited));
    ts.forEachChild(child, visit);
  };
  visit(node);
  return [...new Set(guards)];
}
const files = walk('src/app/api').sort(); let operations = 0;
let api = '# API жагсаалт\n\n2026-10-03 working-tree route exports-оос үүсгэв. `npm run docs:generate` шинэчилнэ; `npm run docs:check` stale reference-ийг илрүүлнэ. Энэ нь OpenAPI schema биш; body/query, RPC state rule-ийн authoritative contract нь холбоос дахь route болон validator.\n\n## Auth ба нийтлэг хариу\n\nBrowser authenticated request нь `Authorization: Bearer <session access_token>`; UI `authFetch` ашиглана. getUser баталгаажуулж, admin/merchant role-ийг fresh profiles-оос уншина. Admin нь merchant API-д автоматаар нэвтрэхгүй. Own гэдэг нь actor ownership filter/RPC validation; supplied owner_id-д итгэхгүй.\n\nError envelope ихэнх route-д `{ "error": "тайлбар", "code": "AUTH_REQUIRED" }`, `Cache-Control: private, no-store`, `X-Request-Id`. Provider callback болон binary delivery нь тусгай хариутай. HTTP: 400 validation; 401 session; 403 role/ownership; 404 missing; 409 revision/stock conflict; 413 body size; 415 media type; 429 quota + Retry-After; 502 provider; 503 dependency/readiness. Энэ table нь route тус бүр бүх status-ийг буцаана гэсэн үг биш.\n\n| Route / source | Methods | Auth / boundary | Purpose |\n| --- | --- | --- | --- |\n';
for (const file of files) {
  const ast = source(file), definitions = new Map(), exports = [];
  for (const node of ast.statements) {
    if (ts.isFunctionDeclaration(node) && node.name) definitions.set(node.name.text, node);
    if (ts.isVariableStatement(node)) for (const declaration of node.declarationList.declarations) definitions.set(name(declaration), declaration);
    if (node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
      if (ts.isFunctionDeclaration(node)) exports.push(name(node));
      if (ts.isVariableStatement(node)) exports.push(...node.declarationList.declarations.map(name));
    }
  }
  const methods = exports.filter(item => /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(item)); operations += methods.length;
  if (!methods.length) throw new Error(`Inspect exports for ${file}`);
  const route = file.replace('src/app', '').replace('/route.ts', '');
  const labels = methods.map(method => {
    let label = guardsFor(ast, method, definitions).map(g => ({ requireAdmin: 'Admin', requireMerchant: 'Merchant, own eligible store', requireUser: 'Authenticated, own/state rules' })[g]).join(' + ') || 'Public';
    if (route === '/api/models') label = 'Public; admin=1 requires Admin';
    if (route.startsWith('/api/models/files/')) label = 'Public allowed delivery; archived requires Admin; source/private blocked';
    if (route.startsWith('/api/payments/callback/')) label = 'Callback token + provider inquiry';
    if (route === '/api/payments/socialpay/notify') label = 'Provider signature + settlement rules';
    if (route === '/api/cron/storage-cleanup') label = 'Constant-time Bearer CRON_SECRET';
    if (route === '/api/telemetry') label = 'Same-origin + anonymous quota/body validation';
    if (route === '/api/kitchen/export/skp') label = method === 'GET' ? 'Public availability only' : 'Same-origin; bounded binary; instance concurrency';
    return label;
  });
  const auth = [...new Set(labels)].length === 1 ? labels[0] : methods.map((m, i) => `${m}: ${labels[i]}`).join('; ');
  const tail = route.split('/').at(-1);
  const purpose = routeDescriptions[route] || descriptions[tail];
  if (!purpose) throw new Error(`Add purpose for ${route}`);
  api += `| [\`${route}\`](../${file}) | ${methods.join(', ')} | ${auth} | ${purpose} |\n`;
}
api += `\nInventory: **${files.length} route files, ${operations} exported HTTP operations**. Framework implicit HEAD/OPTIONS are not separately counted.\n\n`;
api += '## Гол request contract\n\n- `PUT /api/kitchens`: `{id: UUID, name: 1–100 chars, design: validated ModularKitchen, expectedRevision?: integer >= 0}`. Existing editor uses revision; 409 үед overwrite хийхгүй, reload эсвэл Save as copy. DELETE нь `?id=UUID`; versions GET нь owner-filtered revision/cursor query.\n- `PUT /api/room-projects`: `{id, name, document:{schemaVersion:1,design}, expectedRevision, operationId, importKey?, forceVersion?}`; CAS/retry required. Room summaries 30/page, immutable history 30/page; archive PATCH `{archived,expectedRevision}`. [Planner project contract](planner-projects.md).\n- `POST /api/orders/quote`: `{items: selections}` → server quote. `POST /api/orders` нь delivery/payment/idempotency validation болон stock transaction-той. Exact line fields: `lib/orderValidation.ts`; client price/total нь authoritative биш.\n- `POST /api/admin/kitchen-modules`: `{modelId,moduleId,variantCode,opening,doorCount,drawerCount,isDefault,sortOrder,designCode?}` → variant binding (201). Module creation endpoint гэж ойлгохгүй: module catalog нэмэх нь reviewed migration. PATCH `{modelId,active}`; DELETE `{modelId}` нь archive.\n- Upload: upload-url intent → provider PUT → upload-complete preview/checksum/GLB validation → worker. Presigned URL нь түр хугацааны capability; token/URL-ийг лог/changelog-д тавихгүй.\n- Merchant kitchen listing action/status payload-ууд: `kitchenMarketplace.ts`; quote payload: `kitchenQuotes.ts`; product payload: `merchantValidation.ts`. Review/publish action нь snapshot/version state validation-тай.\n- Anonymous contact: name/email/message, capped JSON; telemetry/model metrics нь allowlisted numeric fields. Cron GET нь dry-run default; query-аар role/token bypass хийхгүй.\n\n## Quota / timeout ялгаа\n\nUpload 20/min, render 6/min, quote 30/min, room save/archive 60/min, contact 5/15min, telemetry/model-metrics 120/min. Write-policy route matching нь `lib/rateLimit.ts`; GET page navigation эдгээр quota-д хамаарахгүй. Shared RPC unavailable бол deployed writes 503. SKP export-ийн хоёр concurrent request хамгаалалт нь instance-local бөгөөд shared quota биш; production capacity review-д тусад нь шалгана. Provider/request deadlines нь page navigation-д artificial timeout нэмэхгүй.\n\n[Role matrix](role-permissions.md) · [Data dictionary](data-dictionary.md) · [Troubleshooting](troubleshooting.md)\n';
save('docs/api-reference.md', api);
console.log(JSON.stringify({ tables: tables.members.length + ['api_rate_limit_buckets', 'room_projects', 'room_project_versions'].filter(table => !schemaNames.has(table)).length, routeFiles: files.length, operations, mode: check ? 'check' : 'generate' }));
