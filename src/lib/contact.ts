export function parseContact(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Зурвасын мэдээлэл буруу байна.");
  const raw = value as Record<string, unknown>;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
  const message = typeof raw.message === "string" ? raw.message.trim() : "";
  if (name.length < 2 || name.length > 100) throw new Error("Нэрээ 2–100 тэмдэгтээр оруулна уу.");
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Имэйл хаягаа зөв оруулна уу.");
  if (message.length < 10 || message.length > 5000) throw new Error("Зурвасаа 10–5000 тэмдэгтээр бичнэ үү.");
  return { name, email, message };
}
