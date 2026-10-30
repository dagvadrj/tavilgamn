import "server-only";
import {
  buildSchema,
  execute,
  getOperationAST,
  GraphQLError,
  Kind,
  parse,
  validate,
  type FragmentDefinitionNode,
  type SelectionSetNode,
} from "graphql";
import { getSupabaseAdmin } from "./supabase/admin";
import { jsonArray } from "./supabase/json";
import type { Json } from "./supabase/database.types";
import type { MerchantReadServices } from "./merchantGraphqlReads";

// Explicit output types prevent an opaque JSON API from exposing unselected
// customer fields. Database permissions and ownership RPCs remain unchanged.
export const merchantSchema = buildSchema(`
  enum DeliveryStage { incoming preparing prepared shipped delivered completed }
  type StageCounts { incoming: Int! preparing: Int! prepared: Int! shipped: Int! delivered: Int! completed: Int! }
  type DayTotals { orders: Int! paidOrders: Int! gross: String! net: String! completed: Int! }
  type DailyStat { date: String! count: Int! gross: String! net: String! completed: Int! }
  type ProgressOrder { id: ID! stage: DeliveryStage! progress: Int! createdAt: String! updatedAt: String! customer: String subtotal: String! title: String! itemCount: Int! held: Boolean! }
  type Progress { asOf: String! selectedDate: String! total: Int! hasMore: Boolean! dayTotals: DayTotals! dates: [DailyStat!]! counts: StageCounts! held: Int! aging: [Int!]! orders: [ProgressOrder!]! }
  type MonthStat { month: String! gross: String! net: String! orders: Int! }
  type Trends { asOf: String! months: [MonthStat!]! }
  type Analytics { periodStart: String! asOf: String! storeId: ID! storeName: String! commissionBps: Int! grossRevenue: String! platformFee: String! merchantNet: String! paidOrders: String! pendingOrders: String! processingOrders: String! shippedOrders: String! productCount: String! totalStock: String! lowStockCount: String! modelRequestCount: String! }
  type Address { name: String! phone: String! address: String! floor: Int elevator: String assemblyRequested: Boolean }
  type OrderItem { madeToOrderQuantity: Int productionDays: String productId: ID! name: String! color: String! material: String! colorName: String! materialName: String! qty: Int! unitPrice: Float! lineTotal: Float! }
  type Driver { id: ID! name: String! phone: String! vehicle: String! }
  type Staff { id: ID! name: String! phone: String! vehicle: String! active: Boolean! version: Int! }
  type DeliveryOrder { assemblyTeam: Boolean proofAvailable: Boolean id: ID! items: [OrderItem!]! subtotal: Float! delivery: Address! stage: DeliveryStage! version: Int! createdAt: String! updatedAt: String! completedAt: String paymentStatus: String! cancellationStatus: String driver: Driver }
  type DeliveryColumn { orders: [DeliveryOrder!]! total: Int! hasMore: Boolean! }
  type Order { id: ID! items: [OrderItem!]! subtotal: Float! currency: String! delivery: Address! created_at: String! status: String! paymentStatus: String! commissionBps: Int platformFee: Float merchantNet: Float cancellationStatus: String }
  type OrderPage { orders: [Order!]! hasMore: Boolean! }
  "Validated product specifications with merchant-defined keys. Output only."
  scalar Specifications
  "Validated kitchen planner snapshot. Loaded only on explicit preview."
  scalar KitchenSnapshot
  type Dimensions { w: Float! d: Float! h: Float! }
  type ProductColor { id: String! name: String! hex: String! priceDelta: Float }
  type ProductMaterial { id: String! name: String! priceDelta: Float! }
  type ProductModel { id: ID! file: String! previewFile: String physicalSize: Boolean scale: Float! }
  type SupportSurface { id: ID! width: Float! depth: Float! elevation: Float! }
  type Placement { surfaces: [String!]! defaultElevation: Float gap: Float supportSurfaces: [SupportSurface!] }
  type Product { id: ID! name: String! category: String! description: String! basePrice: Float! compareAtPrice: Float promotionLabel: String promotionEndsAt: String deliveryTerms: String rating: Float! reviewCount: Int! image: String! images: [String!] badges: [String!] defaultColor: String! colors: [ProductColor!]! materials: [ProductMaterial!]! dimensions: Dimensions! inStock: Boolean! madeToOrder: Boolean stockQuantity: Int isNew: Boolean isBestSeller: Boolean modelRequested: Boolean archivedAt: String storeIds: [String!] roomTypes: [String!] model: ProductModel specifications: Specifications placement: Placement }
  type ProductPage { products: [Product!]! nextCursor: String }
  type ModelVersion { id: ID! createdAt: String! name: String! status: String! assetId: ID previewKind: String byteSize: Float }
  type ProductDetails { product: Product! createdAt: String! updatedAt: String! processingStatus: String processingError: String archivedAt: String versions: [ModelVersion!]! }
  type RenderUsage { limit: Int! used: Int! enabled: Boolean! nextResetAt: String }
  type KitchenModel { url: String! widthMm: Float! depthMm: Float! heightMm: Float! bytes: Float! }
  type KitchenMedia { id: ID! kind: String! source: String! url: String! altText: String! isPrimary: Boolean! createdAt: String }
  type RenderJob { id: ID! status: String! inputImageUrl: String prompt: String! provider: String model: String outputMediaId: ID error: String createdAt: String! startedAt: String finishedAt: String }
  type KitchenVersion { id: ID! versionNo: Int! reviewStatus: String! title: String! isPublished: Boolean! createdAt: String! submittedAt: String approvedAt: String }
  type KitchenReview { id: ID! versionId: ID action: String! note: String! createdAt: String! }
  type KitchenAudit { id: ID! actorId: ID action: String! entityType: String! createdAt: String! }
  type ListingSuggestions { titles: [String!]! shortDescriptions: [String!]! descriptions: [String!]! materials: [String!]! tags: [String!]! inclusions: [String!]! exclusions: [String!]! layout: String! cabinetCount: Int! widthMm: Float! depthMm: Float! }
  type KitchenDesign { id: ID! storeId: ID! storeName: String! slug: String! publicationStatus: String! publishedVersionId: ID versionId: ID! versionNo: Int! reviewStatus: String! title: String! shortDescription: String! description: String! style: String! layout: String! tags: [String!]! pricingMode: String! priceFrom: Float priceTo: Float materials: [String!]! sourceKitchenId: ID source: String! model: KitchenModel plannerReady: Boolean! leadTimeDays: Int installationIncluded: Boolean! warrantyMonths: Int serviceAreas: [String!]! inclusions: [String!]! exclusions: [String!]! cabinetCount: Int! roomWidthMm: Float! roomDepthMm: Float! maxHeightMm: Float! thumbnailUrl: String media: [KitchenMedia!]! renderJobs: [RenderJob!]! versions: [KitchenVersion!]! reviews: [KitchenReview!]! audit: [KitchenAudit!]! updatedAt: String! listingSuggestions: ListingSuggestions }
  type KitchenDesignList { eligible: Boolean! storeType: String designs: [KitchenDesign!]! renderUsage: RenderUsage }
  type KitchenDesignDetails { eligible: Boolean! design: KitchenDesign! renderUsage: RenderUsage }
  type QuoteRoom { widthMm: Float depthMm: Float heightMm: Float }
  type KitchenQuote { id: ID! projectName: String! contactName: String! contactPhone: String! contactEmail: String! customerMessage: String! roomDetails: QuoteRoom! status: String! quotedPrice: Float merchantNote: String! cabinetCount: Int! thumbnailUrl: String createdAt: String! updatedAt: String! }
  type KitchenQuotePage { quotes: [KitchenQuote!]! hasMore: Boolean! }
  type QuoteProject { name: String! design: KitchenSnapshot! }
  type Query {
    progress(date: String, page: Int = 0): Progress
    trends: Trends
    analytics: Analytics
    delivery(stage: DeliveryStage!, page: Int = 0): DeliveryColumn
    staff: [Staff!]
    orders(page: Int = 0): OrderPage
    products(after: String, archived: Boolean! = false): ProductPage
    productDetails(id: ID!): ProductDetails
    kitchenDesigns: KitchenDesignList
    kitchenDesign(id: ID!): KitchenDesignDetails
    kitchenQuotes(page: Int = 0, focus: ID): KitchenQuotePage
    quoteProject(id: ID!): QuoteProject
  }
`);

function pageNumber(page: number | null) {
  if (!Number.isInteger(page) || page === null || page < 0 || page > 100000)
    throw new GraphQLError("Хуудасны дугаар буруу байна.", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  return page;
}
function validDate(date: string | null | undefined) {
  if (
    date != null &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date)
  )
    throw new GraphQLError("Огноо буруу байна.", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  return date;
}

type Input = {
  query: string;
  variables?: Record<string, unknown>;
  operationName?: string;
};
type Rpc = ReturnType<typeof getSupabaseAdmin>["rpc"];
function uuid(id: string) {
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id))
    throw new GraphQLError("ID буруу байна.", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  return id;
}
export async function executeMerchantQuery(
  input: Input,
  actor: string,
  rpc: Rpc,
  services?: MerchantReadServices,
) {
  let document;
  try {
    document = parse(input.query, { maxTokens: 2500 });
  } catch {
    return {
      status: 400,
      result: {
        errors: [{ message: "GraphQL query буруу эсвэл хэт том байна." }],
      },
    };
  }
  const errors = validate(merchantSchema, document, undefined, {
    maxErrors: 10,
  });
  if (errors.length)
    return {
      status: 400,
      result: { errors: errors.map((e) => ({ message: e.message })) },
    };
  const operation = getOperationAST(document, input.operationName);
  if (
    !operation ||
    operation.operation !== "query" ||
    document.definitions.filter((d) => d.kind === Kind.OPERATION_DEFINITION)
      .length !== 1
  )
    return {
      status: 400,
      result: { errors: [{ message: "Нэг унших query илгээнэ үү." }] },
    };

  // Count expanded fragments and aliases, not just unique fields. Pagination is
  // fixed to 20 in the database; bound the number/depth of reads per request too.
  const fragments = new Map<string, FragmentDefinitionNode>();
  for (const definition of document.definitions)
    if (definition.kind === Kind.FRAGMENT_DEFINITION)
      fragments.set(definition.name.value, definition);
  let fields = 0,
    roots = 0;
  const withinBudget = (set: SelectionSetNode, depth: number): boolean => {
    if (depth > 8) return false;
    for (const selection of set.selections) {
      if (selection.kind === Kind.FIELD) {
        if (++fields > 300 || (depth === 1 && ++roots > 8)) return false;
        if (
          selection.selectionSet &&
          !withinBudget(selection.selectionSet, depth + 1)
        )
          return false;
      } else {
        const child =
          selection.kind === Kind.INLINE_FRAGMENT
            ? selection
            : fragments.get(selection.name.value);
        if (child && !withinBudget(child.selectionSet, depth)) return false;
      }
    }
    return true;
  };
  if (!withinBudget(operation.selectionSet, 1))
    return {
      status: 400,
      result: { errors: [{ message: "Query хэт олон талбартай байна." }] },
    };

  // Request-local only. The actor always comes from requireMerchant, never input.
  const pending = new Map<string, Promise<Json>>();
  function read(
    name: Parameters<Rpc>[0],
    args: Record<string, string | number>,
  ) {
    const key = JSON.stringify([name, args]);
    let value = pending.get(key);
    if (!value) {
      value = (async () => {
        const { data, error } = await rpc(name, { ...args, p_actor: actor });
        if (error)
          throw new GraphQLError(
            error.code === "42501"
              ? "Дэлгүүрийн эрх өөрчлөгдсөн байна."
              : "Мэдээллийг ачаалж чадсангүй. Дахин оролдоно уу.",
            {
              extensions: {
                code: error.code === "42501" ? "FORBIDDEN" : "UPSTREAM_ERROR",
              },
            },
          );
        return data;
      })();
      pending.set(key, value);
    }
    return value;
  }
  const rootValue = {
    products: ({
      after,
      archived,
    }: {
      after?: string | null;
      archived: boolean;
    }) => {
      if (after != null && !/^[a-zA-Z0-9_-]{1,100}$/.test(after))
        throw new GraphQLError("Cursor буруу байна.");
      return services!.products(actor, after ?? null, archived);
    },
    productDetails: ({ id }: { id: string }) => {
      if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id))
        throw new GraphQLError("Барааны ID буруу байна.");
      return services!.productDetails(actor, id);
    },
    kitchenDesigns: () => services!.kitchenDesigns(actor),
    kitchenDesign: ({ id }: { id: string }) =>
      services!.kitchenDesign(actor, uuid(id)),
    quoteProject: ({ id }: { id: string }) =>
      services!.quoteProject(actor, uuid(id)),
    kitchenQuotes: async ({
      page,
      focus,
    }: {
      page: number | null;
      focus?: string | null;
    }) => {
      const validPage = pageNumber(page);
      const data = jsonArray(
        await read("read_merchant_kitchen_quotes", {
          p_page: focus ? 0 : validPage,
          ...(focus ? { p_focus: uuid(focus) } : {}),
        }),
      );
      return { quotes: data.slice(0, 20), hasMore: data.length > 20 };
    },
    progress: ({
      date,
      page,
    }: {
      date?: string | null;
      page: number | null;
    }) => {
      const day = validDate(date);
      return read("merchant_dashboard_progress", {
        p_page: pageNumber(page),
        ...(day ? { p_date: day } : {}),
      });
    },
    trends: () => read("merchant_dashboard_trends", {}),
    analytics: () => read("merchant_dashboard_analytics", {}),
    delivery: ({ stage, page }: { stage: string; page: number | null }) =>
      read("read_merchant_delivery_orders", {
        p_stage: stage,
        p_page: pageNumber(page),
      }),
    staff: () => read("read_merchant_delivery_staff", {}),
    orders: async ({ page }: { page: number | null }) => {
      const data = jsonArray(
        await read("read_merchant_orders", { p_page: pageNumber(page) }),
      );
      return { orders: data.slice(0, 20), hasMore: data.length > 20 };
    },
  };
  const result = await execute({
    schema: merchantSchema,
    document,
    rootValue,
    variableValues: input.variables,
    operationName: input.operationName,
  });
  // Never include unexpected resolver/database details, stacks or raw extensions.
  return {
    status: result.data === undefined ? 400 : 200,
    result: {
      ...(result.data !== undefined ? { data: result.data } : {}),
      ...(result.errors
        ? {
            errors: result.errors.map((error) => ({
              message:
                error.originalError instanceof GraphQLError
                  ? error.message
                  : "GraphQL мэдээллийг ачаалж чадсангүй.",
              path: error.path,
              extensions: {
                code:
                  error.originalError instanceof GraphQLError
                    ? error.extensions.code
                    : "QUERY_ERROR",
              },
            })),
          }
        : {}),
    },
  };
}
