import { CatalogInputError } from "./catalogValidation";
import { merchantObject } from "./merchantValidation";
import { DELIVERY_STAGES, type DeliveryStage } from "./merchantDelivery";

const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
function id(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value))
    throw new CatalogInputError("Мэдээллийн дугаар буруу байна.");
  return value;
}
function version(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value >= 2147483647
  )
    throw new CatalogInputError(
      "Мэдээллийн хувилбар буруу байна. Жагсаалтаа шинэчилнэ үү.",
    );
  return value;
}
export function parseDeliveryStage(value: unknown): DeliveryStage {
  if (
    typeof value !== "string" ||
    !DELIVERY_STAGES.includes(value as DeliveryStage)
  )
    throw new CatalogInputError("Хүргэлтийн шат буруу байна.");
  return value as DeliveryStage;
}
export function parseDeliveryMove(value: unknown) {
  const raw = merchantObject(value),
    stage = parseDeliveryStage(raw.stage);
  if (stage === "incoming")
    throw new CatalogInputError("Захиалгыг өмнөх шат руу буцаахгүй.");
  const driverId = raw.driverId == null ? null : id(raw.driverId);
  if (stage === "shipped" ? !driverId : !!driverId)
    throw new CatalogInputError(
      "Хүргэлтэд гаргахдаа хүргэлтийн ажилтан сонгоно уу.",
    );
  return {
    orderId: id(raw.orderId),
    stage,
    expectedVersion: version(raw.expectedVersion),
    driverId,
  };
}
export function parseDeliveryStaff(value: unknown, creating: boolean) {
  const raw = merchantObject(value);
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const phone = typeof raw.phone === "string" ? raw.phone.trim() : "";
  const vehicle = typeof raw.vehicle === "string" ? raw.vehicle.trim() : "";
  if (
    name.length < 2 ||
    name.length > 100 ||
    phone.length > 24 ||
    !/^\+?[\d ()-]+$/.test(phone) ||
    phone.replace(/\D/g, "").length < 8 ||
    phone.replace(/\D/g, "").length > 15 ||
    vehicle.length > 100 ||
    typeof raw.active !== "boolean"
  )
    throw new CatalogInputError(
      "Ажилтны нэр, утас, машины мэдээллийг зөв оруулна уу.",
    );
  return {
    id: creating ? null : id(raw.id),
    expectedVersion: creating ? null : version(raw.expectedVersion),
    name,
    phone,
    vehicle,
    active: raw.active,
  };
}
