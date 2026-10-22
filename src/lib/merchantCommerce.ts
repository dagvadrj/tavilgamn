import { CatalogInputError } from "./catalogValidation";
export type ProductExportRow = {
  product_id: string;
  name: string;
  category: string;
  description: string;
  base_price: string | number;
  in_stock: number | null;
  dimensions_w: number;
  dimensions_d: number;
  dimensions_h: number;
  default_color: string | null;
  colors: { id: string; name: string }[];
  materials: { id: string; name: string }[];
  image_url: string | null;
  glb_path: string | null;
  processing_status: string;
  archived_at: string | null;
};
export type ProductExport = {
  rows: ProductExportRow[];
  category: string;
  search: string;
  includeArchived: boolean;
  generatedAt: string;
};
export type ContractVersion = {
  id: string;
  version_no: number;
  title: string;
  platform_name: string;
  body: string;
  status: string;
  revision: number;
  published_at: string | null;
};
export type ContractAcceptance = {
  id: string;
  contract_id: string;
  store_id: string;
  signer_name: string;
  accepted_at: string;
  commission_bps: number;
  store_snapshot: {
    name: string;
    address: string;
    phone: string;
    legalName: string | null;
  };
};
export type MerchantContractsData = {
  current: ContractVersion | null;
  acceptances: { acceptance: ContractAcceptance; contract: ContractVersion }[];
};
export type AdminContractsData = {
  versions: ContractVersion[];
  acceptances: (ContractAcceptance & { version_no: number })[];
};
export type ReportOrder = {
  orderId: string;
  createdAt: string;
  day: string;
  orderStatus: string;
  status: string;
  stage: string;
  paid: boolean;
  cancelled: boolean;
  gross: string;
  fee: string;
  net: string;
  commissionBps: number;
  items: { productId: string; name: string; qty: number }[];
};
export type MerchantReport = {
  storeId: string;
  storeName: string;
  from: string;
  to: string;
  generatedAt: string;
  orders: ReportOrder[];
  transactions: {
    id: string;
    kind: string;
    amount: string;
    credits: string;
    status: string;
    reference: string | null;
    createdAt: string;
  }[];
  wallet: {
    earned: string;
    available: string;
    reserved: string;
    credits: string;
  };
};
export function reportingPeriod(from: string | null, to: string | null) {
  const valid = (value: string | null): value is string =>
    !!value &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
  if (
    !valid(from) ||
    !valid(to) ||
    to < from ||
    Date.parse(to) - Date.parse(from) > 365 * 86400000
  )
    throw new CatalogInputError(
      "Эхлэх/дуусах огноогоо зөв сонгоно уу. Нэг тайлан 366 хүртэл хоног байна.",
    );
  return { from, to };
}
export function reportTotals(report: MerchantReport) {
  const paid = report.orders.filter((order) => order.paid && !order.cancelled);
  const sum = (key: "gross" | "fee" | "net") =>
    paid.reduce((n, order) => n + BigInt(order[key]), 0n).toString();
  return {
    orders: report.orders.length,
    paid: paid.length,
    cancelled: report.orders.filter((order) => order.cancelled).length,
    gross: sum("gross"),
    fee: sum("fee"),
    net: sum("net"),
  };
}
export const reportMoney = (s: string) =>
  BigInt(s).toLocaleString("mn-MN") + " ₮";
export const reportStatus = (s: string) =>
  ({
    waiting: "Хүлээгдэж буй",
    preparing: "Бэлтгэж буй",
    prepared: "Бэлэн",
    shipped: "Хүргэлтэд гарсан",
    delivered: "Хүргэгдсэн",
    completed: "Дууссан",
    pending: "Хүлээгдэж буй",
    paid: "Төлөгдсөн",
    rejected: "Татгалзсан",
    cancelled: "Цуцлагдсан",
    payout: "Мөнгө таталт",
    credit_purchase: "Кредит худалдан авалт",
  })[s] ?? s;
