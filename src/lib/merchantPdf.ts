import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, rgb, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { CATEGORY_LABEL } from "./catalogCategories";
import {
  reportTotals,
  reportStatus,
  type MerchantReport,
  type ProductExport,
  type ContractVersion,
  type ContractAcceptance,
} from "./merchantCommerce";
async function pdfWriter(title: string) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(
    await readFile(
      join(process.cwd(), "public/fonts/pt-sans/PT_Sans-Web-Regular.ttf"),
    ),
    { subset: true },
  );
  doc.setTitle(title);
  doc.setAuthor("tavilga.mn");
  const supported = new Set(font.getCharacterSet()),
    ink = rgb(0.12, 0.16, 0.22),
    muted = rgb(0.4, 0.44, 0.5);
  const clean = (s: string) =>
    [...s.replace(/₮/g, "төг").replace(/[\x00-\x08\x0b-\x1f\x7f]/g, " ")]
      .map((c) => (c === "\n" || supported.has(c.codePointAt(0)!) ? c : "?"))
      .join("");
  const wrap = (s: string, width: number, size = 10) => {
    const lines: string[] = [];
    for (const paragraph of clean(s).split("\n")) {
      let line = "";
      for (const word of paragraph.split(/\s+/)) {
        if (
          font.widthOfTextAtSize(line ? line + " " + word : word, size) <= width
        ) {
          line += (line ? " " : "") + word;
          continue;
        }
        if (line) lines.push(line);
        line = "";
        for (const ch of word) {
          if (line && font.widthOfTextAtSize(line + ch, size) > width) {
            lines.push(line);
            line = "";
          }
          line += ch;
        }
      }
      lines.push(line);
    }
    return lines;
  };
  let page: PDFPage,
    y = 0;
  const write = (s: string, x: number, pos: number, size = 10) =>
    page.drawText(clean(s), { x, y: pos, size, font, color: ink });
  const addPage = () => {
    page = doc.addPage([595.28, 841.89]);
    y = 790;
    write("TAVILGA.MN", 42, y, 12);
    y -= 24;
  };
  const ensure = (height: number) => {
    if (y - height < 60) addPage();
  };
  addPage();
  const text = (s: string, size = 10) => {
    for (const line of wrap(s, 511, size)) {
      ensure(size + 6);
      write(line, 42, y, size);
      y -= size + 6;
    }
    y -= 6;
  };
  const table = (headers: string[], rows: string[][], widths: number[]) => {
    const heading = () => {
      let x = 42;
      headers.forEach((header, i) => {
        wrap(header, widths[i] - 10, 9).forEach((l, k) =>
          write(l, x, y - k * 12, 9),
        );
        x += widths[i];
      });
      y -= 35;
    };
    ensure(65);
    heading();
    for (const row of rows) {
      const cells = row.map((cell, i) => wrap(cell, widths[i] - 10, 9));
      const height = Math.max(...cells.map((c) => c.length)) * 12 + 12;
      if (y - height < 60) {
        addPage();
        heading();
      }
      let x = 42;
      cells.forEach((cell, i) => {
        cell.forEach((line, j) => write(line, x, y - j * 12, 9));
        x += widths[i];
      });
      y -= height;
      page.drawLine({
        start: { x: 42, y: y + 6 },
        end: { x: 553, y: y + 6 },
        thickness: 0.4,
        color: rgb(0.84, 0.87, 0.9),
      });
    }
    y -= 12;
  };
  const save = () => {
    const pages = doc.getPages();
    pages.forEach((p, i) =>
      p.drawText(`tavilga.mn · ${i + 1} / ${pages.length}`, {
        x: 42,
        y: 30,
        size: 9,
        font,
        color: muted,
      }),
    );
    return doc.save();
  };
  return { text, table, save };
}
export async function merchantProductsPdf(data: ProductExport) {
  const pdf = await pdfWriter("Барааны жагсаалт");
  pdf.text("БАРААНЫ ЖАГСААЛТ", 18);
  pdf.text(
    `Ангилал: ${CATEGORY_LABEL[data.category as keyof typeof CATEGORY_LABEL] ?? "Бүх ангилал"}\nХайлт: ${data.search || "Бүгд"}\nАрхивласан: ${data.includeArchived ? "Хамт" : "Харахгүй"}\nНийт: ${data.rows.length} бараа`,
  );
  if (!data.rows.length) pdf.text("Энэ шүүлтүүрт бараа байхгүй.");
  pdf.table(
    ["Нэр / ангилал", "Хэмжээ (см)", "Үнэ (төг)", "Нөөц", "Төлөв"],
    data.rows.map((p) => [
      p.name +
        "\n" +
        (CATEGORY_LABEL[p.category as keyof typeof CATEGORY_LABEL] ??
          p.category),
      [p.dimensions_w, p.dimensions_d, p.dimensions_h]
        .map((n) => Number((n * 100).toFixed(2)))
        .join(" × "),
      String(p.base_price),
      p.in_stock === null ? "Тодорхойгүй" : String(p.in_stock),
      p.archived_at ? "Архивласан" : "Идэвхтэй",
    ]),
    [190, 100, 100, 50, 71],
  );
  pdf.text(
    "Үүсгэсэн: " +
      new Date(data.generatedAt).toLocaleString("mn-MN", {
        timeZone: "Asia/Ulaanbaatar",
      }),
    9,
  );
  return pdf.save();
}
export async function merchantReportPdf(report: MerchantReport) {
  const pdf = await pdfWriter("Дэлгүүрийн тайлан"),
    totals = reportTotals(report);
  pdf.text("ДЭЛГҮҮРИЙН ТАЙЛАН", 18);
  pdf.text(report.storeName, 14);
  pdf.text(`${report.from} - ${report.to} · Asia/Ulaanbaatar`);
  pdf.text(
    "Хугацааг захиалга үүссэн өдрөөр шүүсэн. Дуусах өдрийг бүтнээр оруулсан.",
  );
  pdf.table(
    ["Үзүүлэлт", "Дүн"],
    [
      ["Нийт захиалга", String(totals.orders)],
      ["Төлбөртэй, цуцлагдаагүй", String(totals.paid)],
      ["Цуцлагдсан", String(totals.cancelled)],
      ["Төлбөртэй захиалгын дүн", totals.gross + " төг"],
      ["Шимтгэл", totals.fee + " төг"],
      ["Дэлгүүрийн дүн", totals.net + " төг"],
      ["Одоогийн боломжит үлдэгдэл", report.wallet.available + " төг"],
      ["Одоогийн түгжигдсэн дүн", report.wallet.reserved + " төг"],
    ],
    [330, 181],
  );
  pdf.text(
    "Шимтгэлийг захиалгын snapshot-аас авсан. Хэтэвчийн үлдэгдэл нь тайлан үүсгэх мөчийн бүх хугацааны дүн. Төлбөргүй/цуцлагдсан захиалгууд борлуулалтын нийлбэрт орохгүй.",
  );
  pdf.text("ЗАХИАЛГЫН ЗАДАРГАА", 13);
  pdf.table(
    ["Захиалга / өдөр", "Төлөв", "Барааны дүн", "Шимтгэл", "Дэлгүүрийн дүн"],
    report.orders.map((o) => [
      o.orderId.slice(0, 8) + "\n" + o.day,
      reportStatus(o.stage) +
        "\n" +
        (o.cancelled ? "Цуцлагдсан" : o.paid ? "Төлбөртэй" : "Төлбөргүй"),
      o.gross,
      o.fee,
      o.net,
    ]),
    [110, 104, 99, 99, 99],
  );
  pdf.text("ХЭТЭВЧИЙН ГҮЙЛГЭЭ", 13);
  if (!report.transactions.length)
    pdf.text("Сонгосон хугацаанд гүйлгээ байхгүй.");
  else
    pdf.table(
      ["Огноо / ID", "Төрөл", "Дүн (төг)", "Төлөв"],
      report.transactions.map((t) => [
        new Date(t.createdAt).toLocaleDateString("mn-MN", {
          timeZone: "Asia/Ulaanbaatar",
        }) +
          "\n" +
          t.id.slice(0, 8),
        reportStatus(t.kind),
        t.amount,
        reportStatus(t.status),
      ]),
      [140, 150, 111, 110],
    );
  pdf.text(
    "Үүсгэсэн: " +
      new Date(report.generatedAt).toLocaleString("mn-MN", {
        timeZone: "Asia/Ulaanbaatar",
      }),
    9,
  );
  return pdf.save();
}
export async function merchantContractPdf(
  contract: ContractVersion,
  accepted?: ContractAcceptance,
) {
  const pdf = await pdfWriter(contract.title);
  pdf.text(accepted ? "ЗӨВШӨӨРСӨН ГЭРЭЭ" : "ГЭРЭЭ - ТАНИЛЦАХ ХУВЬ", 16);
  pdf.text(contract.title, 14);
  pdf.text(`Хувилбар ${contract.version_no} · ${contract.platform_name}`);
  if (accepted) {
    pdf.text(
      `Дэлгүүр: ${accepted.store_snapshot.name}\nХуулийн этгээд: ${accepted.store_snapshot.legalName || "Бүртгээгүй"}\nТөлөөлөгч: ${accepted.signer_name}\nЗөвшөөрсөн: ${new Date(accepted.accepted_at).toLocaleString("mn-MN", { timeZone: "Asia/Ulaanbaatar" })}\nТухайн үеийн шимтгэл: ${accepted.commission_bps / 100}%\nБүртгэлийн дугаар: ${accepted.id}`,
    );
  }
  pdf.text(contract.body);
  if (accepted)
    pdf.text(
      "Энэ хувь нь платформ дээрх зөвшөөрлийн бүртгэл. Тоон гарын үсгийн баталгаажуулалт агуулаагүй.",
      9,
    );
  return pdf.save();
}
