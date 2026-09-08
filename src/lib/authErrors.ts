const messages: Record<string, string> = {
  invalid_credentials: "Имэйл эсвэл нууц үг буруу байна. Шалгаад дахин оролдоно уу.",
  email_not_confirmed: "Имэйл хаягаа баталгаажуулна уу. Имэйлээр ирсэн баталгаажуулах холбоосыг нээгээд дахин нэвтэрнэ үү.",
  email_exists: "Энэ имэйлээр бүртгэл үүссэн байна. Нэвтрэх хэсгийг ашиглана уу.",
  user_already_exists: "Энэ имэйлээр бүртгэл үүссэн байна. Нэвтрэх хэсгийг ашиглана уу.",
  weak_password: "Нууц үг шаардлага хангахгүй байна. Том, жижиг үсэг, тоо, тэмдэгт хослуулсан урт нууц үг сонгоно уу.",
  email_address_invalid: "Имэйл хаягаа шалгаж, хүчинтэй хаяг оруулна уу.",
  email_address_not_authorized: "Энэ хаяг руу баталгаажуулах имэйл илгээх боломжгүй байна. Холбоо барих хэсгээр бидэнд мэдэгдэнэ үү.",
  signup_disabled: "Шинэ бүртгэл түр хаалттай байна. Дараа дахин оролдоно уу.",
  email_provider_disabled: "Имэйлээр бүртгүүлэх үйлчилгээ түр боломжгүй байна. Дараа дахин оролдоно уу.",
  over_email_send_rate_limit: "Имэйл илгээх хязгаарт хүрсэн байна. Хэдэн минут хүлээгээд дахин оролдоно уу.",
  over_request_rate_limit: "Богино хугацаанд олон хүсэлт илгээсэн байна. Хэдэн минут хүлээгээд дахин оролдоно уу.",
  request_timeout: "Хүсэлтийн хугацаа дууслаа. Холболтоо шалгаад дахин оролдоно уу.",
  user_banned: "Энэ бүртгэлээр нэвтрэх боломжгүй байна. Холбоо барих хэсгээр бидэнд хандана уу.",
  session_expired: "Нэвтрэлтийн хугацаа дууссан байна. Дахин нэвтэрнэ үү.",
  refresh_token_not_found: "Нэвтрэлтийн хугацаа дууссан байна. Дахин нэвтэрнэ үү.",
};

// Stable service codes take precedence over provider wording.
export function authErrorMessage(error: unknown, action: "signIn" | "signUp"): string {
  const detail = error && typeof error === "object"
    ? error as { code?: string; status?: number; name?: string; message?: string }
    : {};
  if (detail.code && Object.prototype.hasOwnProperty.call(messages, detail.code)) return messages[detail.code];
  if (detail.status === 429) return messages.over_request_rate_limit;
  if (detail.name === "AuthRetryableFetchError" || /failed to fetch|fetch failed|network request failed|networkerror/i.test(detail.message ?? "")) {
    return "Сервертэй холбогдож чадсангүй. Интернэт холболтоо шалгаад дахин оролдоно уу.";
  }
  // Older providers may omit codes; translate only recognized messages.
  const legacy = (detail.message ?? "").toLowerCase();
  if (legacy === "invalid login credentials") return messages.invalid_credentials;
  if (legacy === "email not confirmed") return messages.email_not_confirmed;
  if (legacy === "user already registered") return messages.user_already_exists;
  return action === "signIn"
    ? "Нэвтэрч чадсангүй. Түр хүлээгээд дахин оролдоно уу."
    : "Бүртгэл үүсгэж чадсангүй. Түр хүлээгээд дахин оролдоно уу.";
}
