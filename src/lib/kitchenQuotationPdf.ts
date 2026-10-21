import { PDFDocument, rgb, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { KitchenCommerce } from "./kitchenQuotation";
import { quotationLineTotal } from "./kitchenQuotation";
export async function kitchenQuotationPdf(
  quote: KitchenCommerce,
  fontBytes: Uint8Array,
) {
  if (!quote.document) throw new Error("Үнийн санал бэлэн болоогүй.");
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes, { subset: true });
  doc.setTitle(`${quote.projectName} · Үнийн санал`);
  doc.setAuthor(quote.storeName);
  let page!: PDFPage,
    y = 0;
  const ink = rgb(0.12, 0.15, 0.2),
    muted = rgb(0.4, 0.44, 0.5),
    blue = rgb(0.1, 0.33, 0.73);
  const supported = new Set(font.getCharacterSet());
  const clean = (s: string) =>
    [...s.replace(/₮/g, "төг").replace(/[\x00-\x1f]/g, " ")]
      .map((c) => (supported.has(c.codePointAt(0)!) ? c : "?"))
      .join("");
  const write = (s: string, x: number, pos: number, size = 10, color = ink) =>
    page.drawText(clean(s), { x, y: pos, size, font, color });
  const wrap = (text: string, width: number, size: number) => {
    const result: string[] = [];
    let line = "";
    for (const word of clean(text).split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        line = candidate;
        continue;
      }
      if (line) result.push(line);
      line = "";
      for (const char of word) {
        if (line && font.widthOfTextAtSize(line + char, size) > width) {
          result.push(line);
          line = "";
        }
        line += char;
      }
    }
    if (line) result.push(line);
    return result;
  };
  const addPage = () => {
    page = doc.addPage([595.28, 841.89]);
    y = 782;
    write("TAVILGA.MN", 42, y, 12, blue);
    write("ҮНИЙН САНАЛ", 390, y, 16, blue);
    y -= 35;
  };
  const ensure = (height: number) => {
    if (y - height < 70) addPage();
  };
  addPage();
  for (const title of [quote.storeName, quote.projectName])
    for (const line of wrap(title, 510, 14)) {
      ensure(20);
      write(line, 42, y, 14);
      y -= 20;
    }
  write(
    `№ ${quote.document.quote_id.slice(0, 8).toUpperCase()} · ${new Date(quote.document.created_at).toLocaleDateString("mn-MN", { timeZone: "Asia/Ulaanbaatar" })}`,
    42,
    y,
    10,
    muted,
  );
  y -= 32;
  const heading = () => {
    page.drawRectangle({
      x: 42,
      y: y - 8,
      width: 511,
      height: 26,
      color: rgb(0.93, 0.96, 1),
    });
    write("Модуль / ажил", 50, y);
    write("Тоо / нэгж", 280, y);
    write("Нэгж үнэ (төг)", 365, y);
    write("Дүн (төг)", 473, y);
    y -= 30;
  };
  heading();
  const amount = (n: number) => n.toLocaleString("en-US");
  for (const item of quote.document.items) {
    const name = wrap(item.name, 215, 10),
      units = wrap(`${item.quantity} ${item.unit}`, 75, 10),
      height = Math.max(name.length, units.length) * 14 + 17;
    if (y - height < 80) {
      addPage();
      heading();
    }
    name.forEach((line, i) => write(line, 50, y - i * 14));
    units.forEach((line, i) => write(line, 280, y - i * 14));
    write(
      amount(item.unitPrice),
      440 - font.widthOfTextAtSize(amount(item.unitPrice), 10),
      y,
    );
    const sum = amount(quotationLineTotal(item));
    write(sum, 548 - font.widthOfTextAtSize(sum, 10), y);
    y -= height;
    page.drawLine({
      start: { x: 42, y: y + 8 },
      end: { x: 553, y: y + 8 },
      thickness: 0.5,
      color: rgb(0.86, 0.88, 0.91),
    });
  }
  ensure(70);
  y -= 15;
  write("НИЙТ ДҮН", 300, y, 13, blue);
  const total = `${amount(quote.document.total)} төг`;
  write(total, 548 - font.widthOfTextAtSize(total, 16), y - 25, 16, blue);
  y -= 65;
  for (const line of wrap(quote.document.note, 510, 10)) {
    ensure(15);
    write(line, 42, y, 10, muted);
    y -= 15;
  }
  if (quote.appointment) {
    y -= 16;
    for (const line of wrap(
      `Хэмжилт: ${quote.appointment.engineer} · ${new Date(quote.appointment.starts_at).toLocaleString("mn-MN", { timeZone: "Asia/Ulaanbaatar" })}`,
      510,
      10,
    )) {
      ensure(15);
      write(line, 42, y, 10, muted);
      y -= 15;
    }
  }
  const pages = doc.getPages();
  pages.forEach((p, index) =>
    p.drawText(`tavilga.mn · ${index + 1} / ${pages.length}`, {
      x: 42,
      y: 34,
      size: 9,
      font,
      color: muted,
    }),
  );
  return doc.save();
}
