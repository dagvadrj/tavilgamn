// Pure query documents: no GraphQL runtime is shipped to the browser.
const item = `productId name color material colorName materialName qty unitPrice lineTotal`;
const address = `name phone address`;
const order = `id items { ${item} } subtotal delivery { ${address} }`;
const progress = `asOf selectedDate total hasMore held aging
  dayTotals { orders paidOrders gross net completed }
  dates { date count gross net completed }
  counts { incoming preparing prepared shipped delivered completed }
  orders { id stage progress createdAt updatedAt customer subtotal title itemCount held }`;
const product = `id name category description basePrice compareAtPrice promotionLabel promotionEndsAt deliveryTerms rating reviewCount image images badges defaultColor
  colors { id name hex priceDelta } materials { id name priceDelta } dimensions { w d h }
  inStock stockQuantity isNew isBestSeller modelRequested archivedAt storeIds roomTypes specifications
  model { id file previewFile physicalSize scale } placement { surfaces defaultElevation gap supportSurfaces { id width depth elevation } }`;
const kitchen = `id storeId storeName slug publicationStatus publishedVersionId versionId versionNo reviewStatus title shortDescription description style layout tags pricingMode priceFrom priceTo materials sourceKitchenId leadTimeDays installationIncluded warrantyMonths serviceAreas inclusions exclusions cabinetCount roomWidthMm roomDepthMm maxHeightMm thumbnailUrl updatedAt`;
const usage = `limit used enabled nextResetAt`;

// Existing resource URLs remain stable cache keys during the staged migration.
// Only these reads use GraphQL; writes and other pages retain their API contract.
export function merchantQueryFor(path: string) {
  const url = new URL(path, "https://merchant.local");
  const params = url.searchParams;
  const page = Number(params.get("page") ?? 0);
  switch (url.pathname) {
    case "/api/merchant/products":
      return {
        query: `query MerchantProducts($after: String, $archived: Boolean!) { products(after: $after, archived: $archived) { products { ${product} } nextCursor } }`,
        operationName: "MerchantProducts",
        variables: {
          after: params.get("after"),
          archived: params.get("archived") === "1",
        },
        field: "products",
        paginate: true,
      };
    case "/api/merchant/kitchen-designs":
      return {
        query: `query MerchantKitchenDesigns { kitchenDesigns { eligible storeType designs { ${kitchen} } renderUsage { ${usage} } } }`,
        operationName: "MerchantKitchenDesigns",
        field: "kitchenDesigns",
      };
    case "/api/merchant/kitchen-quotes":
      return {
        query: `query MerchantKitchenQuotes($page: Int!, $focus: ID) { kitchenQuotes(page: $page, focus: $focus) { quotes { id projectName contactName contactPhone contactEmail customerMessage roomDetails { widthMm depthMm heightMm } status quotedPrice merchantNote cabinetCount thumbnailUrl createdAt updatedAt } hasMore } }`,
        operationName: "MerchantKitchenQuotes",
        variables: { page, focus: params.get("quote") },
        field: "kitchenQuotes",
      };
    case "/api/merchant/dashboard":
      if (params.get("section") === "progress")
        return {
          query: `query MerchantProgress($date: String, $page: Int!) { progress(date: $date, page: $page) { ${progress} } }`,
          operationName: "MerchantProgress",
          variables: { date: params.get("date"), page },
          field: "progress",
        };
      if (params.get("section") === "trends")
        return {
          query: `query MerchantTrends { trends { asOf months { month gross net orders } } }`,
          operationName: "MerchantTrends",
          field: "trends",
        };
      return null;
    case "/api/merchant/analytics":
      return {
        query: `query MerchantAnalytics { analytics { periodStart asOf storeId storeName commissionBps grossRevenue platformFee merchantNet paidOrders pendingOrders processingOrders shippedOrders productCount totalStock lowStockCount modelRequestCount } }`,
        operationName: "MerchantAnalytics",
        field: "analytics",
        wrap: true,
      };
    case "/api/merchant/delivery":
      return {
        query: `query MerchantDelivery($stage: DeliveryStage!, $page: Int!) { delivery(stage: $stage, page: $page) { total hasMore orders { ${order} stage version createdAt updatedAt completedAt paymentStatus cancellationStatus driver { id name phone vehicle } } } }`,
        operationName: "MerchantDelivery",
        variables: { stage: params.get("stage"), page },
        field: "delivery",
      };
    case "/api/merchant/delivery/staff":
      return {
        query: `query MerchantStaff { staff { id name phone vehicle active version } }`,
        operationName: "MerchantStaff",
        field: "staff",
        wrap: true,
      };
    case "/api/merchant/orders":
      return {
        query: `query MerchantOrders($page: Int!) { orders(page: $page) { hasMore orders { ${order} currency created_at status paymentStatus commissionBps platformFee merchantNet cancellationStatus } } }`,
        operationName: "MerchantOrders",
        variables: { page },
        field: "orders",
      };
    default:
      const details = url.pathname.match(
        /^\/api\/merchant\/products\/([^/]+)\/details$/,
      );
      if (details && !params.has("assetId"))
        return {
          query: `query MerchantProductDetails($id: ID!) { productDetails(id: $id) { product { ${product} } createdAt updatedAt processingStatus processingError archivedAt versions { id createdAt name status assetId previewKind byteSize } } }`,
          operationName: "MerchantProductDetails",
          variables: { id: decodeURIComponent(details[1]) },
          field: "productDetails",
        };
      const design = url.pathname.match(
        /^\/api\/merchant\/kitchen-designs\/([^/]+)$/,
      );
      if (design)
        return {
          query: `query MerchantKitchenDesign($id: ID!) { kitchenDesign(id: $id) { eligible design { ${kitchen}
          media { id kind source url altText isPrimary createdAt }
          renderJobs { id status inputImageUrl prompt provider model outputMediaId error createdAt startedAt finishedAt }
          versions { id versionNo reviewStatus title isPublished createdAt submittedAt approvedAt }
          reviews { id versionId action note createdAt } audit { id actorId action entityType createdAt }
          listingSuggestions { titles shortDescriptions descriptions materials tags inclusions exclusions layout cabinetCount widthMm depthMm }
        } renderUsage { ${usage} } } }`,
          operationName: "MerchantKitchenDesign",
          variables: { id: decodeURIComponent(design[1]) },
          field: "kitchenDesign",
        };
      const project = url.pathname.match(
        /^\/api\/merchant\/kitchen-quotes\/([^/]+)\/project$/,
      );
      if (project)
        return {
          query: `query MerchantQuoteProject($id: ID!) { quoteProject(id: $id) { name design } }`,
          operationName: "MerchantQuoteProject",
          variables: { id: decodeURIComponent(project[1]) },
          field: "quoteProject",
        };
      return null;
  }
}
