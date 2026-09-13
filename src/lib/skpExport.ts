import "server-only";

export const MAX_KITCHEN_EXPORT_BYTES = 4 * 1024 * 1024;
export class ExportError extends Error { constructor(message: string, public status = 400) { super(message); } }
export function skpConverterConfig() {
  const endpoint = process.env.SKP_CONVERTER_URL, token = process.env.SKP_CONVERTER_TOKEN;
  if (!endpoint || !token) return null;
  const url = new URL(endpoint);
  const local = process.env.NODE_ENV !== "production" && ["127.0.0.1", "localhost"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) || url.username || url.password || url.search || url.hash) return null;
  return { endpoint: url.href.replace(/\/$/, ""), token };
}
export async function readBoundedBody(body: ReadableStream<Uint8Array> | null, max = MAX_KITCHEN_EXPORT_BYTES) {
  if (!body) throw new ExportError("Экспортлох файл алга.");
  const reader = body.getReader(), chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.length;
      if (length > max) { await reader.cancel(); throw new ExportError("Файл экспортын хэмжээнээс хэтэрлээ. GLB татаж ашиглана уу.", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks, length);
}
export function validateKitchenGlb(data: Buffer) {
  if (data.length < 20 || data.readUInt32LE(0) !== 0x46546c67 || data.readUInt32LE(4) !== 2 || data.readUInt32LE(8) !== data.length || data.readUInt32LE(16) !== 0x4e4f534a) throw new ExportError("GLB бүтэц буруу байна.");
  const length = data.readUInt32LE(12);
  if (length > 1024 * 1024 || length + 20 > data.length) throw new ExportError("GLB metadata буруу байна.");
  let json;
  try { json = JSON.parse(data.toString("utf8", 20, 20 + length)); } catch { throw new ExportError("GLB metadata буруу байна."); }
  if (!json.nodes?.some((node: { extras?: { kitchenExport?: boolean } }) => node.extras?.kitchenExport === true)) throw new ExportError("Kitchen planner-ээс экспортолсон файл шаардлагатай.");
  if ([...(json.buffers ?? []), ...(json.images ?? [])].some(item => item.uri)) throw new ExportError("Бүх texture, geometry GLB дотроо байх ёстой.");
}
export async function convertKitchenSkp(data: Buffer, signal?: AbortSignal) {
  const config = skpConverterConfig();
  if (!config) throw new ExportError("SKP хөрвүүлэгч сервер холбогдоогүй байна.", 503);
  validateKitchenGlb(data);
  const response = await fetch(config.endpoint + "/convert", {
    method: "POST", headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "model/gltf-binary" },
    body: new Uint8Array(data), redirect: "error", cache: "no-store", signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(55000)]) : AbortSignal.timeout(55000),
  });
  if (!response.ok) { await response.body?.cancel(); throw new ExportError(response.status === 429 ? "Хөрвүүлэгч завгүй байна. Түр хүлээгээд дахин оролдоно уу." : "SKP хөрвүүлэлт амжилтгүй боллоо.", response.status === 429 ? 429 : 502); }
  const result = await readBoundedBody(response.body);
  if (result.length < 32 || !result.subarray(0, 64).includes(Buffer.from("SketchUp Model", "utf16le"))) throw new ExportError("Хөрвүүлэгчээс зөв SKP файл ирсэнгүй.", 502);
  return result;
}
