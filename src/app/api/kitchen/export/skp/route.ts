import { NextRequest, NextResponse } from "next/server";
import { ExportError, MAX_KITCHEN_EXPORT_BYTES, convertKitchenSkp, readBoundedBody, skpConverterConfig } from "@/lib/skpExport";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "no-store" };
let inFlight = 0;
export async function GET() {
  try { return NextResponse.json({ available: !!skpConverterConfig() }, { headers }); }
  catch { return NextResponse.json({ available: false }, { headers }); }
}
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  let sameOrigin = !origin;
  try { if (origin) { const source = new URL(origin); sameOrigin = ["http:", "https:"].includes(source.protocol) && source.host === request.headers.get("host"); } } catch { /* Reject malformed Origin. */ }
  if (!sameOrigin) return NextResponse.json({ error: "Хүсэлтийн эх үүсвэр буруу байна." }, { status: 403, headers });
  if (request.headers.get("content-type")?.split(";")[0] !== "model/gltf-binary") return NextResponse.json({ error: "GLB файл шаардлагатай." }, { status: 415, headers });
  if (Number(request.headers.get("content-length")) > MAX_KITCHEN_EXPORT_BYTES) return NextResponse.json({ error: "Файлын хэмжээ 4 MiB-аас их байна." }, { status: 413, headers });
  if (inFlight >= 2) return NextResponse.json({ error: "Экспорт завгүй байна. Дахин оролдоно уу." }, { status: 429, headers });
  inFlight++;
  try {
    if (!skpConverterConfig()) throw new ExportError("SKP хөрвүүлэгч сервер холбогдоогүй байна.", 503);
    const data = await readBoundedBody(request.body);
    const skp = await convertKitchenSkp(data, request.signal);
    return new NextResponse(new Uint8Array(skp), { headers: { ...headers, "Content-Type": "application/octet-stream", "Content-Disposition": 'attachment; filename="kitchen.skp"', "Content-Length": String(skp.length) } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof ExportError ? error.message : "SKP сервертэй холбогдож чадсангүй. Дахин оролдоно уу." }, { status: error instanceof ExportError ? error.status : 502, headers });
  } finally { inFlight--; }
}
