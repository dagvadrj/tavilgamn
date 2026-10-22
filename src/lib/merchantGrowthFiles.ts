import { CatalogInputError } from "./catalogValidation";

export function validateGrowthFile(
  bytes: Uint8Array,
  name: string,
  kind: "certificate" | "model",
) {
  const extension = name.split(".").at(-1)?.toLowerCase();
  if (
    !bytes.length ||
    bytes.length > (kind === "certificate" ? 10 : 50) * 1024 * 1024
  )
    throw new CatalogInputError(
      kind === "certificate"
        ? "Гэрчилгээ 10 MB хүртэл байна."
        : "3D файл 50 MB хүртэл байна.",
    );
  const prefix = String.fromCharCode(...bytes.slice(0, 12));
  if (kind === "certificate") {
    if (extension === "pdf" && prefix.startsWith("%PDF-"))
      return { extension, contentType: "application/pdf" };
    if (
      ["jpg", "jpeg"].includes(extension ?? "") &&
      bytes[0] === 255 &&
      bytes[1] === 216 &&
      bytes[2] === 255
    )
      return { extension: "jpg", contentType: "image/jpeg" };
    if (
      extension === "png" &&
      [137, 80, 78, 71, 13, 10, 26, 10].every(
        (value, index) => bytes[index] === value,
      )
    )
      return { extension, contentType: "image/png" };
    throw new CatalogInputError("PDF, JPG эсвэл PNG гэрчилгээ сонгоно уу.");
  }
  if (extension === "glb" && prefix.startsWith("glTF") && bytes.length >= 20) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (
      view.getUint32(4, true) === 2 &&
      view.getUint32(8, true) === bytes.byteLength
    )
      return { extension, contentType: "model/gltf-binary" };
  }
  if (extension === "gltf") {
    let gltf;
    try {
      gltf = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new CatalogInputError("glTF JSON файл буруу байна.");
    }
    if (
      gltf?.asset?.version !== "2.0" ||
      !Array.isArray(gltf.buffers) ||
      !gltf.buffers.length ||
      !gltf.buffers.every(
        (buffer: { uri?: unknown } | null) =>
          buffer &&
          typeof buffer.uri === "string" &&
          buffer.uri.startsWith("data:"),
      ) ||
      (gltf.images &&
        (!Array.isArray(gltf.images) ||
          !gltf.images.every(
            (image: { uri?: unknown; bufferView?: unknown } | null) =>
              image &&
              (typeof image.bufferView === "number" ||
                (typeof image.uri === "string" &&
                  image.uri.startsWith("data:"))),
          )))
    )
      throw new CatalogInputError(
        "glTF 2.0 нь зураг, binary өгөгдлөө дотроо агуулсан self-contained файл байна. Эсвэл .glb ашиглана уу.",
      );
    return { extension, contentType: "model/gltf+json" };
  }
  throw new CatalogInputError(
    "GLB 2.0 эсвэл self-contained glTF 2.0 файл сонгоно уу.",
  );
}

export async function readGrowthForm(
  request: Request,
  maximum = 51 * 1024 * 1024,
) {
  if (
    !request.headers.get("content-type")?.startsWith("multipart/form-data") ||
    !request.body
  )
    throw new CatalogInputError("Файл илгээх бүтэц буруу байна.");
  const reader = request.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let length = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > maximum) {
        await reader.cancel();
        throw new CatalogInputError("Файлын хэмжээ хэтэрсэн байна.");
      }
      chunks.push(new Uint8Array(chunk.value));
    }
  } finally {
    reader.releaseLock();
  }
  return new Response(new Blob(chunks), {
    headers: { "Content-Type": request.headers.get("content-type")! },
  }).formData();
}
