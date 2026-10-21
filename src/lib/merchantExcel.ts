import "server-only";
import { styleSheet } from "./merchantWorkbookStyle";
import * as ExcelJS from "exceljs";
import { Unzip, UnzipInflate } from "fflate";
import { createHash } from "node:crypto";
import { CatalogInputError } from "./catalogValidation";
import { parseMerchantProduct } from "./merchantValidation";
import { CATEGORIES } from "./catalogCategories";
import type { Product } from "./types";

export const IMPORT_LIMIT = 500;
export const IMPORT_BYTES = 5 * 1024 * 1024;
export const IMPORT_COLUMNS = [
  ["name", "Нэр", true],
  ["category", "Ангилал", true],
  ["price", "Үнэ (₮)", true],
  ["stock", "Нөөц", true],
  ["width", "Өргөн (см)", true],
  ["depth", "Гүн (см)", true],
  ["height", "Өндөр (см)", true],
  ["material", "Материал", true],
  ["color", "Өнгө", false],
  ["hex", "Өнгөний код", false],
  ["image", "Зургийн URL", false],
  ["description", "Тайлбар", false],
] as const;
const materials: Record<string, string> = {
  wood: "Мод",
  metal: "Металл",
  fabric: "Даавуу",
  leather: "Арьс",
  velvet: "Хилэн",
};
const normalize = (s: string) => s.trim().toLowerCase().replace(/\*/g, "");
function fail(s: string): never {
  throw new CatalogInputError(s);
}

/** Bound actual inflated bytes before ExcelJS parses any XML. Never extracts files to disk. */
export function checkWorkbookArchive(bytes: Uint8Array) {
  if (bytes.length > IMPORT_BYTES || bytes[0] !== 0x50 || bytes[1] !== 0x4b)
    fail(
      "5 MB-аас бага .xlsx файл сонгоно уу. .xls файлаа .xlsx болгон хадгална уу.",
    );
  let total = 0,
    entries = 0;
  const names = new Set<string>();
  const archive = new Unzip((file) => {
    if (++entries > 500 || names.has(file.name))
      fail("Excel архивын бүтэц буруу байна.");
    names.add(file.name);
    if (/vbaProject|externalLinks|embeddings/i.test(file.name))
      fail("Макро, гаднын холбоос, хавсаргасан объекттой файл ашиглахгүй.");
    file.ondata = (error, chunk) => {
      if (error) fail("Excel архивыг задлаж чадсангүй.");
      total += chunk.length;
      if (total > 25 * 1024 * 1024)
        fail("Задалсан Excel файл 25 MB-аас том байна.");
    };
    file.start();
  });
  archive.register(UnzipInflate);
  try {
    for (let offset = 0; offset < bytes.length; offset += 4096)
      archive.push(
        bytes.subarray(offset, offset + 4096),
        offset + 4096 >= bytes.length,
      );
  } catch (error) {
    if (error instanceof CatalogInputError) throw error;
    fail("Excel архив гэмтсэн байна.");
  }
  if (!names.has("xl/workbook.xml")) fail("Зөв .xlsx файл сонгоно уу.");
}

export type ImportRow = {
  row: number;
  name: string;
  category: string;
  price: number | null;
  errors: string[];
  product?: Product;
};
export async function parseMerchantWorkbook(
  bytes: Uint8Array,
  requestId: string,
) {
  checkWorkbookArchive(bytes);
  const book = new ExcelJS.Workbook();
  try {
    await book.xlsx.load(new Uint8Array(bytes).buffer);
  } catch {
    fail("Excel файлыг уншиж чадсангүй.");
  }
  const sheet = book.getWorksheet("Бараа") ?? book.worksheets[0];
  if (!sheet || sheet.rowCount > IMPORT_LIMIT + 1 || sheet.columnCount > 40)
    fail("Бараа sheet-д нэг удаа 1–500 мөр, 40 хүртэл багана оруулна уу.");
  const mapped = new Map<string, number>();
  const scalar = (cell: ExcelJS.Cell) => {
    const value = cell.value;
    if (value == null) return "";
    if (typeof value === "string" || typeof value === "number") return value;
    fail(
      "Томьёо, холбоос, зурагтай нүд ашиглахгүй. Утга болгон Paste values хийнэ үү.",
    );
  };
  sheet.getRow(1).eachCell((cell, index) => {
    const text = normalize(String(scalar(cell)));
    const field = IMPORT_COLUMNS.find(
      ([key, label]) => text === normalize(label) || text === key,
    );
    if (!field) {
      if (text)
        fail(
          `Танихгүй багана: ${String(scalar(cell)).slice(0, 80)}. Загвар файлын толгойг ашиглана уу.`,
        );
      return;
    }
    if (mapped.has(field[0])) fail(`Давхардсан багана: ${field[1]}`);
    mapped.set(field[0], index);
  });
  for (const [key, label, required] of IMPORT_COLUMNS)
    if (required && !mapped.has(key))
      fail(`Шаардлагатай багана алга: ${label}`);
  const rows: ImportRow[] = [],
    seen = new Set<string>();
  sheet.eachRow((row, rowNo) => {
    if (rowNo === 1) return;
    const result: ImportRow = {
      row: rowNo,
      name: "",
      category: "",
      price: null,
      errors: [],
    };
    try {
      const raw = Object.fromEntries(
        IMPORT_COLUMNS.map(([key]) => [
          key,
          mapped.has(key) ? scalar(row.getCell(mapped.get(key)!)) : "",
        ]),
      );
      if (Object.values(raw).every((v) => String(v).trim() === "")) return;
      const text = (key: string) => String(raw[key] ?? "").trim();
      result.name = text("name");
      const cat = CATEGORIES.find(
        (c) =>
          c.id === text("category") ||
          c.name.toLowerCase() === text("category").toLowerCase(),
      );
      if (!cat || cat.id === "kitchen-cabinet")
        fail("Ангиллаа шалгана уу. Гал тогооны GLB-г тусдаа сангаар нэмнэ.");
      result.category = cat.name;
      const numeric = (
        key: string,
        label: string,
        max: number,
        whole = false,
      ) => {
        const value = raw[key];
        const s = String(value).trim();
        if (!/^(?:\d+|\d*\.\d+)$/.test(s))
          fail(`${label}: зөв тоон утга оруулна уу (таслалгүй).`);
        const n = Number(s);
        if (
          !Number.isFinite(n) ||
          n < 0 ||
          n > max ||
          (whole && !Number.isSafeInteger(n))
        )
          fail(`${label}: хэмжээ, бүхэл тооны хязгаараа шалгана уу.`);
        return n;
      };
      const material = Object.entries(materials).find(
        ([id, label]) =>
          text("material").toLowerCase() === id ||
          text("material").toLowerCase() === label.toLowerCase(),
      );
      if (!material)
        fail("Материал: Мод, Металл, Даавуу, Арьс эсвэл Хилэн сонгоно уу.");
      const hash = createHash("sha256")
        .update(`${requestId}:${rowNo}`)
        .digest("hex");
      const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
      const product = parseMerchantProduct(
        {
          name: text("name"),
          category: cat.id,
          description: text("description"),
          basePrice: numeric("price", "Үнэ", Number.MAX_SAFE_INTEGER, true),
          stockQuantity: numeric("stock", "Нөөц", 1_000_000, true),
          dimensions: {
            w: numeric("width", "Өргөн", 10000) / 100,
            d: numeric("depth", "Гүн", 10000) / 100,
            h: numeric("height", "Өндөр", 10000) / 100,
          },
          image: text("image") || "/image.png",
          images: [],
          colors: [
            {
              id: "default",
              name: text("color") || "Үндсэн өнгө",
              hex: text("hex") || "#C9A37A",
              priceDelta: 0,
            },
          ],
          defaultColor: "default",
          materials: [{ id: material[0], name: material[1], priceDelta: 0 }],
        },
        id,
      );
      const fingerprint = JSON.stringify({ ...product, id: "" });
      if (seen.has(fingerprint))
        fail("Энэ файлд ижил бараа давхар орсон байна.");
      seen.add(fingerprint);
      result.product = product;
      result.price = product.basePrice;
    } catch (error) {
      result.errors.push(
        error instanceof CatalogInputError
          ? error.message
          : "Мөрийн утгуудыг шалгана уу.",
      );
    }
    rows.push(result);
  });
  if (!rows.length)
    fail("Импортлох бараа алга. Загварын жишээг өөрийн бараагаар солино уу.");
  return {
    rows,
    valid: rows.every((row) => !row.errors.length),
    hash: createHash("sha256").update(bytes).digest("hex"),
  };
}

export async function merchantImportTemplate() {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Бараа");
  sheet.addRow(
    IMPORT_COLUMNS.map(([, label, required]) => label + (required ? "*" : "")),
  );
  sheet.addRow([
    "Жишээ буйдан — өөрийн бараагаар солино",
    "Буйдан",
    1599000,
    5,
    214,
    104,
    86,
    "Даавуу",
    "Ногоон",
    "#8A9A83",
    "",
    "Энэ мөрийг устгаад өөрийн бараагаа оруулна уу.",
  ]);
  styleSheet(sheet);
  const categorySheet = book.addWorksheet("Ангилал");
  categorySheet.addRow(["Ангиллын нэр", "Код"]);
  CATEGORIES.filter((c) => c.id !== "kitchen-cabinet").forEach((c) =>
    categorySheet.addRow([c.name, c.id]),
  );
  styleSheet(categorySheet);
  const help = book.addWorksheet("Заавар");
  help.addRow(["Талбар", "Тайлбар"]);
  [
    [
      "Импорт",
      "Зөвхөн шинэ бараа нэмнэ; өмнөх барааг засахгүй. Жишээ мөрийг өөрийн бараагаар солино.",
    ],
    [
      "Хязгаар",
      "Зөвхөн .xlsx, 5 MB, 500 мөр. Бараа sheet-ийн толгойн нэрийг өөрчлөхгүй.",
    ],
    [
      "Хэмжээ",
      "Өргөн/гүн/өндөр сантиметрээр. Ж: 214 см; аравтын бутархайг цэгээр бичнэ.",
    ],
    [
      "Үнэ / Нөөц",
      "Төгрөг / ширхэг. Таслалгүй бүхэл тоо. Томьёог Paste values хийнэ.",
    ],
    [
      "Материал",
      "Мод, Металл, Даавуу, Арьс, Хилэн (wood, metal, fabric, leather, velvet).",
    ],
    [
      "Зураг",
      "Хоосон бол placeholder. Зөвшөөрөгдсөн Cloudinary, Unsplash URL эсвэл local зам. Дараа нь бараа засах хэсэгт зураг, 3D нэмнэ.",
    ],
    [
      "Өнгө",
      "Нэг үндсэн өнгө. Нэр болон #RRGGBB код. Дараа нь нэмэлт сонголтуудыг засаж болно.",
    ],
    ["Гал тогоо", "Гал тогооны модуль/GLB санг тусад нь ашиглана."],
  ].forEach((row) => help.addRow(row));
  styleSheet(help);
  help.getColumn(2).width = 100;
  help.eachRow((row, i) => {
    if (i > 1) row.height = 36;
  });
  for (let row = 2; row <= IMPORT_LIMIT + 1; row++) {
    sheet.getCell(row, 2).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: [`'Ангилал'!$A$2:$A$${categorySheet.rowCount}`],
    };
    sheet.getCell(row, 8).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: ['"Мод,Металл,Даавуу,Арьс,Хилэн"'],
    };
  }
  // Validation-only cells intentionally span the supported import range.
  return book.xlsx.writeBuffer();
}
