// Public contact details. Leave email empty until a real inbox is configured.
export const SITE_CONTACT = {
  email: process.env.CONTACT_EMAIL?.trim() || "",
  phone: process.env.CONTACT_PHONE?.trim() || "+976 88442741",
};

export function phoneHref(phone: string): string {
  return `tel:${phone.replace(/[^+\d]/g, "")}`;
}
