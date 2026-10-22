import { CatalogInputError } from "./catalogValidation";

export type GrowthProfile = {
  store_id?: string;
  slug?: string | null;
  legal_name?: string;
  registration_no?: string;
  certificate_path?: string | null;
  verification_status?: string;
  verification_version?: number;
  bank_name?: string;
  bank_account?: string;
  bank_holder?: string;
  bank_status?: string;
  bank_version?: number;
  review_note?: string;
  bank_note?: string;
  storeName?: string;
};
export type GrowthSettings = {
  credit_price_mnt: number;
  background_credits: number;
  render_credits: number;
  model_credits: number;
};
export type WalletTransaction = {
  id: string;
  store_id: string;
  kind: string;
  amount: string | number;
  credits: string | number;
  status: string;
  created_at: string;
  review_note: string;
  reference: string | null;
  storeName?: string;
  bank_snapshot?: { bank: string; account: string; holder: string };
};
export type ModelSubmission = {
  id: string;
  store_id: string;
  product_id: string;
  original_name: string;
  status: string;
  review_note: string;
  created_at: string;
  storeName?: string;
};
export type MerchantGrowth = {
  shareOrigin?: string;
  storeId: string;
  profile: GrowthProfile;
  wallet: {
    earned: string;
    available: string;
    reserved: string;
    credits: string;
  };
  settings: GrowthSettings;
  productCount: number;
  modelCount: number;
  transactions: WalletTransaction[];
  creditHistory: {
    id: string;
    delta: string | number;
    reason: string;
    created_at: string;
  }[];
  modelSubmissions: ModelSubmission[];
};
export type MerchantInsightsData = {
  days: number;
  asOf: string;
  net: string;
  gross: string;
  orders: string;
  series: { date: string; net: string; gross: string; orders: string }[];
  topRevenue: TopProduct[];
  topQuantity: TopProduct[];
};
export type TopProduct = {
  id: string;
  name: string;
  quantity: string;
  revenue: string;
};
export type AdminGrowth = {
  profiles: GrowthProfile[];
  withdrawals: WalletTransaction[];
  models: ModelSubmission[];
  settings: GrowthSettings;
};
export const growthMoney = (value: string | number) =>
  BigInt(value).toLocaleString("mn-MN") + " ₮";
export const growthCount = (value: string | number) =>
  BigInt(value).toLocaleString("mn-MN");
export function growthObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new CatalogInputError("Мэдээллийн бүтэц буруу байна.");
  return value as Record<string, unknown>;
}
export function growthText(value: unknown, min: number, max: number) {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max
  )
    throw new CatalogInputError("Талбарын утга эсвэл урт буруу байна.");
  return value.trim();
}
export function growthInteger(value: unknown, max = 1000000, min = 0): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  )
    throw new CatalogInputError("Бүхэл тоон утга оруулна уу.");
  return value;
}
export function growthUuid(value: unknown) {
  const id = growthText(value, 36, 36);
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id))
    throw new CatalogInputError("Хүсэлтийн ID буруу байна.");
  return id;
}
export function parseGrowthAction(value: unknown) {
  const data = growthObject(value);
  if (data.action === "slug") {
    const slug = growthText(data.slug, 3, 40).toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(slug))
      throw new CatalogInputError(
        "Холбоост латин жижиг үсэг, тоо, зураас ашиглана уу.",
      );
    return { action: "slug", data: { slug } };
  }
  if (data.action === "bank") {
    const account = growthText(data.account, 8, 50)
      .replace(/\s/g, "")
      .toUpperCase();
    if (!/^[A-Z0-9]{8,34}$/.test(account))
      throw new CatalogInputError("Данс эсвэл IBAN дугаараа шалгана уу.");
    return {
      action: "bank",
      data: {
        bankName: growthText(data.bankName, 2, 100),
        account,
        holder: growthText(data.holder, 2, 200),
      },
    };
  }
  throw new CatalogInputError("Үйлдэл буруу байна.");
}
export function parseWalletAction(value: unknown) {
  const data = growthObject(value);
  if (data.kind !== "withdrawal" && data.kind !== "credits")
    throw new CatalogInputError("Хэтэвчийн үйлдэл буруу байна.");
  return {
    kind: data.kind,
    quantity: growthInteger(
      data.quantity,
      data.kind === "credits" ? 1000000 : Number.MAX_SAFE_INTEGER,
      1,
    ),
    requestKey: growthUuid(data.requestKey),
  };
}
export function parseAdminGrowthAction(value: unknown) {
  const data = growthObject(value);
  const action = growthText(data.action, 2, 30);
  const storeId =
    action === "settings" ? undefined : growthText(data.storeId, 1, 200);
  const note =
    typeof data.note === "string" ? data.note.trim().slice(0, 1000) : "";
  if (action === "settings")
    return {
      action,
      data: {
        price: growthInteger(data.price),
        background: growthInteger(data.background, 100000),
        render: growthInteger(data.render, 100000),
        model: growthInteger(data.model, 100000),
      },
    };
  if (action === "verification" || action === "bank") {
    if (data.status !== "approved" && data.status !== "rejected")
      throw new CatalogInputError("Шийдвэр буруу байна.");
    return {
      action,
      data: {
        storeId,
        status: data.status,
        version: growthInteger(data.version, Number.MAX_SAFE_INTEGER, 1),
        note,
      },
    };
  }
  if (action === "grant")
    return {
      action,
      data: {
        storeId,
        credits: growthInteger(data.credits, 1000000, 1),
        reference: growthText(data.reference, 3, 200),
        requestKey: growthUuid(data.requestKey),
      },
    };
  if (action === "withdrawal") {
    if (data.status !== "paid" && data.status !== "rejected")
      throw new CatalogInputError("Шийдвэр буруу байна.");
    if (data.status === "paid" && data.transferConfirmed !== true)
      throw new CatalogInputError(
        "Банкны шилжүүлгийг хийснээ баталгаажуулна уу.",
      );
    return {
      action,
      data: {
        storeId,
        id: growthUuid(data.id),
        status: data.status,
        reference:
          data.status === "paid" ? growthText(data.reference, 3, 200) : "",
        transferConfirmed: data.transferConfirmed === true,
        note,
      },
    };
  }
  if (action === "model") {
    if (data.status !== "accepted" && data.status !== "rejected")
      throw new CatalogInputError("Шийдвэр буруу байна.");
    return {
      action,
      data: { storeId, id: growthUuid(data.id), status: data.status, note },
    };
  }
  throw new CatalogInputError("Admin үйлдэл буруу байна.");
}
export function onboardingSteps(
  growth: MerchantGrowth | null,
  address: string | undefined,
) {
  return [
    {
      id: "verification",
      title: "ААН-ийн гэрчилгээ баталгаажуулах",
      done: growth?.profile.verification_status === "approved",
      pending: growth?.profile.verification_status === "pending",
      description:
        "Verified Merchant тэмдэг авч, хэрэглэгчийн итгэлийг нэмэгдүүлээрэй.",
    },
    {
      id: "bank",
      title: "Орлого хүлээн авах дансаа холбох",
      done: growth?.profile.bank_status === "approved",
      pending: growth?.profile.bank_status === "pending",
      description: "Банк, данс болон эзэмшигчийн мэдээллээ баталгаажуулна.",
    },
    {
      id: "product",
      title: "Эхний бараа болон 3D загвараа оруулах",
      done: (growth?.productCount ?? 0) > 0 && (growth?.modelCount ?? 0) > 0,
      pending: (growth?.modelSubmissions ?? []).some(
        (item) => item.status === "pending",
      ),
      description:
        "Бараагаа нэмээд .glb эсвэл self-contained .gltf файлаа хавсаргаарай.",
    },
    {
      id: "showroom",
      title: "Шоурум / салбарын хаяг оруулах",
      done: Boolean(
        address && address.trim() !== "-" && address.trim().length >= 5,
      ),
      pending: false,
      description: "Хэрэглэгч очиж үзэх боломжтой биет дэлгүүрийн хаяг.",
    },
  ];
}
