import "server-only";
import * as ExcelJS from "exceljs";
import { styleSheet } from "./merchantWorkbookStyle";
import { CATEGORY_LABEL } from "./catalogCategories";
import {
  reportTotals,
  reportStatus,
  type MerchantReport,
  type ProductExport,
} from "./merchantCommerce";
const numeric = (s: string) => {
  const n = Number(s);
  // Excel preserves only 15 significant decimal digits; larger amounts stay exact text.
  return Number.isSafeInteger(n) && s.replace(/^-/, "").length <= 15 ? n : s;
};
export async function merchantReportExcel(report: MerchantReport) {
  const book = new ExcelJS.Workbook(),
    totals = reportTotals(report);
  book.creator = "tavilga.mn";
  book.created = new Date(report.generatedAt);
  const summary = book.addWorksheet("Тойм");
  summary.addRow(["Үзүүлэлт", "Утга"]);
  [
    ["Дэлгүүр", report.storeName],
    ["Эхлэх өдөр", report.from],
    ["Дуусах өдөр", report.to],
    [
      "Хугацааны суурь",
      "Захиалга үүссэн өдөр; Asia/Ulaanbaatar. Дуусах өдрийг бүтнээр оруулсан.",
    ],
    ["Нийт захиалга", totals.orders],
    ["Төлбөртэй, цуцлагдаагүй", totals.paid],
    ["Цуцлагдсан", totals.cancelled],
    ["Төлбөртэй захиалгын дүн (₮)", numeric(totals.gross)],
    ["Шимтгэл (₮)", numeric(totals.fee)],
    ["Дэлгүүрийн дүн (₮)", numeric(totals.net)],
    ["Одоогийн боломжит үлдэгдэл (₮)", numeric(report.wallet.available)],
    ["Одоогийн түгжигдсэн дүн (₮)", numeric(report.wallet.reserved)],
    [
      "Үлдэгдлийн суурь",
      "Үүсгэх мөчийн бүх хугацааны үлдэгдэл; сонгосон хугацааны борлуулалттай ижил биш.",
    ],
    [
      "Тооцоолол",
      "Шимтгэл, дэлгүүрийн дүн нь захиалгын snapshot. Төлбөргүй/цуцлагдсан захиалгууд нийлбэрт орохгүй.",
    ],
    ["Тайлан үүссэн", new Date(report.generatedAt)],
    [
      "Excel нарийвчлал",
      "15-аас олон цифртэй мөнгөн дүнг нарийвчлал алдахгүйн тулд текстээр хадгалсан.",
    ],
  ].forEach((row) => summary.addRow(row));
  styleSheet(summary);
  summary.getColumn(1).width = 43;
  summary.getColumn(2).width = 85;
  summary.eachRow((row, i) => {
    if (i > 1) row.height = 32;
  });
  summary.getCell("B16").numFmt = "yyyy-mm-dd hh:mm";
  const orders = book.addWorksheet("Захиалга");
  orders.addRow([
    "Захиалгын ID",
    "Огноо (УБ)",
    "Хүргэлтийн төлөв",
    "Төлбөртэй",
    "Цуцлагдсан",
    "Барааны дүн (₮)",
    "Шимтгэл (₮)",
    "Дэлгүүрийн дүн (₮)",
    "Шимтгэл (%)",
  ]);
  report.orders.forEach((order) =>
    orders.addRow([
      order.orderId,
      order.day,
      reportStatus(order.stage),
      order.paid ? "Тийм" : "Үгүй",
      order.cancelled ? "Тийм" : "Үгүй",
      numeric(order.gross),
      numeric(order.fee),
      numeric(order.net),
      order.commissionBps / 10000,
    ]),
  );
  styleSheet(orders);
  orders.getColumn(1).width = 40;
  [6, 7, 8].forEach((i) => (orders.getColumn(i).numFmt = '#,##0 "₮"'));
  orders.getColumn(9).numFmt = "0.0%";
  const lines = book.addWorksheet("Барааны задаргаа");
  lines.addRow([
    "Захиалгын ID",
    "Барааны ID",
    "Нэр",
    "Тоо (ш)",
    "Нийлбэрт орсон",
  ]);
  report.orders.forEach((order) =>
    order.items.forEach((item) =>
      lines.addRow([
        order.orderId,
        item.productId,
        item.name,
        item.qty,
        order.paid && !order.cancelled ? "Тийм" : "Үгүй",
      ]),
    ),
  );
  styleSheet(lines);
  lines.getColumn(1).width = 40;
  lines.getColumn(3).width = 45;
  const ledger = book.addWorksheet("Хэтэвчийн гүйлгээ");
  ledger.addRow([
    "Гүйлгээний ID",
    "Огноо (УБ)",
    "Төрөл",
    "Дүн (₮)",
    "Кредит",
    "Төлөв",
    "Лавлагаа",
  ]);
  report.transactions.forEach((tx) =>
    ledger.addRow([
      tx.id,
      new Date(tx.createdAt).toLocaleString("sv-SE", {
        timeZone: "Asia/Ulaanbaatar",
      }),
      reportStatus(tx.kind),
      numeric(tx.amount),
      numeric(tx.credits),
      reportStatus(tx.status),
      tx.reference ?? "",
    ]),
  );
  styleSheet(ledger);
  ledger.getColumn(1).width = 40;
  ledger.getColumn(4).numFmt = '#,##0 "₮"';
  return book.xlsx.writeBuffer();
}

export async function merchantProductsExcel(data: ProductExport) {
  const book = new ExcelJS.Workbook(),
    sheet = book.addWorksheet("Бараа");
  sheet.addRow([
    "Барааны ID",
    "Нэр",
    "Ангилал",
    "Үнэ (₮)",
    "Нөөц (ш)",
    "Өргөн (см)",
    "Гүн (см)",
    "Өндөр (см)",
    "Өнгө",
    "Материал",
    "Зураг",
    "3D загвар",
    "Төлөв",
    "Тайлбар",
  ]);
  data.rows.forEach((p) =>
    sheet.addRow([
      p.product_id,
      p.name,
      CATEGORY_LABEL[p.category as keyof typeof CATEGORY_LABEL] ?? p.category,
      numeric(String(p.base_price)),
      p.in_stock,
      p.dimensions_w * 100,
      p.dimensions_d * 100,
      p.dimensions_h * 100,
      p.colors.map((c) => c.name).join(", "),
      p.materials.map((m) => m.name).join(", "),
      p.image_url ?? "",
      p.processing_status === "ready" && p.glb_path ? "Бэлэн" : "Байхгүй",
      p.archived_at ? "Архивласан" : "Идэвхтэй",
      p.description,
    ]),
  );
  styleSheet(sheet);
  sheet.getColumn(1).width = 40;
  sheet.getColumn(2).width = 40;
  sheet.getColumn(4).numFmt = '#,##0 "₮"';
  [6, 7, 8].forEach((i) => (sheet.getColumn(i).numFmt = "0.##"));
  const filters = book.addWorksheet("Шүүлтүүр");
  filters.addRow(["Шүүлтүүр", "Утга"]);
  [
    [
      "Ангилал",
      CATEGORY_LABEL[data.category as keyof typeof CATEGORY_LABEL] ??
        "Бүх ангилал",
    ],
    ["Хайлт", data.search || "Бүгд"],
    ["Архивласан", data.includeArchived ? "Хамт" : "Харахгүй"],
    ["Барааны тоо", data.rows.length],
    ["Үүсгэсэн", new Date(data.generatedAt)],
  ].forEach((r) => filters.addRow(r));
  styleSheet(filters);
  filters.getColumn(2).width = 50;
  filters.getCell("B6").numFmt = "yyyy-mm-dd hh:mm";
  return book.xlsx.writeBuffer();
}
