import { unzipSync } from "fflate";
import { CatalogInputError } from "./catalogValidation";

export const CONTRACT_FILE_LIMIT = 10 * 1024 * 1024;
export const CONTRACT_BUCKET = "merchant-contracts";
export const DOCX_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function validateContractFile(bytes: Uint8Array, name: string) {
  if (!bytes.length || bytes.length > CONTRACT_FILE_LIMIT)
    throw new CatalogInputError("Гэрээний файл 10 MB хүртэл байна.");
  const extension = name.split(".").at(-1)?.toLowerCase();
  if (
    extension === "pdf" &&
    new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-"
  )
    return { extension, contentType: "application/pdf" };
  if (extension === "docx") {
    try {
      let macro = false;
      const files = unzipSync(bytes, {
        filter: (entry) => {
          if (/vbaProject|macros/i.test(entry.name)) macro = true;
          if (
            !["[Content_Types].xml", "word/document.xml"].includes(entry.name)
          )
            return false;
          if (entry.originalSize > 5 * 1024 * 1024)
            throw new Error("Document too large");
          return true;
        },
      });
      const types = files["[Content_Types].xml"],
        document = files["word/document.xml"];
      if (
        !macro &&
        types?.length &&
        document?.length &&
        new TextDecoder()
          .decode(types)
          .includes(
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
          ) &&
        new TextDecoder().decode(document).includes("wordprocessingml")
      )
        return { extension, contentType: DOCX_TYPE };
    } catch {
      /* Report invalid archives with the same user-facing error. */
    }
  }
  throw new CatalogInputError("Зөв бүтэцтэй PDF эсвэл DOCX гэрээ сонгоно уу.");
}

export function contractFilename(name: string) {
  return name
    .split(/[\\/]/)
    .at(-1)!
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .slice(0, 255);
}

export function contractStoreId(value: unknown, required = true) {
  if ((value === null || value === undefined || value === "") && !required)
    return undefined;
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > 200 ||
    /[\u0000-\u001f]/.test(value)
  )
    throw new CatalogInputError("Гэрээ байгуулах merchant-ээ сонгоно уу.");
  return value;
}
