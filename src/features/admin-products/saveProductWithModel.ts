import type { Product } from "@/lib/types";
import type { GlbPreviewResult } from "@/components/GlbUploadPreview";
import { specificationFields } from "@/lib/productSpecifications";

export type ProductSaveCheckpoint = {
  id: string;
  stockQuantity: number | null;
};
export async function saveProductWithModel({
  product,
  checkpoint,
  file,
  preview,
  moduleId,
  request,
  upload = fetch,
  assertOwner,
  onSaved,
  onProgress,
}: {
  product: Product;
  checkpoint: ProductSaveCheckpoint | null;
  file: File | null;
  preview: GlbPreviewResult | null;
  moduleId: string;
  request: (url: string, init: RequestInit) => Promise<Response>;
  upload?: typeof fetch;
  assertOwner: () => void;
  onSaved: (value: ProductSaveCheckpoint) => void;
  onProgress: (message: string) => void;
}) {
  if (
    file &&
    (!file.name.toLowerCase().endsWith(".glb") ||
      file.size < 12 ||
      file.size > 200 * 1024 * 1024)
  )
    throw new Error("200 MB-аас ихгүй GLB файл сонгоно уу.");
  if (file && (!preview || preview.file !== file || !preview.frontConfirmed))
    throw new Error(
      "3D урьдчилсан харагдац дээр хэмжээ, босоо байрлал болон нүүрэн талыг шалгаж батална уу.",
    );
  assertOwner();
  const json = (body: unknown): RequestInit => ({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  onProgress("Бүтээгдэхүүнийг хадгалж байна…");
  const response = await request("/api/admin/products", {
    ...json({
      ...product,
      ...(product.specifications
        ? {
            specifications: Object.fromEntries(
              specificationFields(product.category)
                .filter((field) => product.specifications?.[field.key]?.trim())
                .map((field) => [
                  field.key,
                  product.specifications![field.key],
                ]),
            ),
          }
        : {}),
      id: checkpoint?.id ?? product.id,
      expectedStockQuantity: checkpoint?.stockQuantity ?? null,
    }),
    method: checkpoint ? "PUT" : "POST",
  });
  const saved = await response.json().catch(() => null);
  if (!response.ok || typeof saved?.id !== "string")
    throw new Error(saved?.error ?? "Бүтээгдэхүүнийг хадгалж чадсангүй.");
  assertOwner();
  // Keep the real ID before uploading: a failed GLB retry updates this product.
  onSaved({ id: saved.id, stockQuantity: product.stockQuantity ?? null });
  if (!file || !preview) return;
  onProgress("3D файл оруулахад бэлдэж байна…");
  const preparation = await request(
    "/api/admin/models/upload-url",
    json({
      productId: saved.id,
      fileName: file.name,
      size: file.size,
      moduleId,
    }),
  );
  const prepared = await preparation.json().catch(() => null);
  if (
    !preparation.ok ||
    typeof prepared?.uploadUrl !== "string" ||
    typeof prepared?.sourcePath !== "string" ||
    typeof prepared?.modelId !== "string"
  )
    throw new Error(prepared?.error ?? "3D файл оруулах холбоос үүссэнгүй.");
  assertOwner();
  onProgress("3D файлыг оруулж байна…");
  const uploaded = await upload(prepared.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "model/gltf-binary" },
    body: file,
  });
  if (!uploaded.ok)
    throw new Error(`3D файл оруулж чадсангүй (${uploaded.status}).`);
  assertOwner();
  onProgress("3D загварыг боловсруулалтад оруулж байна…");
  const completion = await request(
    "/api/admin/models/upload-complete",
    json({
      modelId: prepared.modelId,
      sourcePath: prepared.sourcePath,
      frontConfirmed: preview.frontConfirmed,
      frontProjectionMm: preview.report.frontProjectionMm,
    }),
  );
  const completed = await completion.json().catch(() => null);
  if (!completion.ok)
    throw new Error(
      completed?.error ?? "3D загварын боловсруулалт эхэлсэнгүй.",
    );
  assertOwner();
}
