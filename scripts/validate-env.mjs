const core = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
];
const production = process.argv.includes("--production");

const featureGroups = {
  bank_transfer: ["BANK_NAME", "BANK_ACCOUNT", "BANK_ACCOUNT_HOLDER"],
  cloudinary: [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
  ],
  qpay: [
    "QPAY_BASE_URL",
    "QPAY_USERNAME",
    "QPAY_PASSWORD",
    "QPAY_INVOICE_CODE",
  ],
  r2: [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
  ],
  socialpay: [
    "SOCIALPAY_BASE_URL",
    "SOCIALPAY_BEARER_TOKEN",
    "SOCIALPAY_SECRET",
  ],
};

const value = (name) => process.env[name]?.trim() ?? "";
const errors = [];
const warnings = [];

for (const name of core) {
  if (!value(name)) errors.push(`${name} is required`);
}

if (production && !value("APP_URL")) errors.push("APP_URL is required");

for (const [feature, names] of Object.entries(featureGroups)) {
  if (!names.some(value)) continue;
  for (const name of names) {
    if (!value(name)) {
      const message = `${feature}: ${name} is required when enabled`;
      (production ? errors : warnings).push(message);
    }
  }
}

for (const name of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "APP_URL",
  "QPAY_BASE_URL",
  "SOCIALPAY_BASE_URL",
]) {
  if (!value(name)) continue;
  try {
    const parsed = new URL(value(name));
    const local = ["localhost", "127.0.0.1"].includes(parsed.hostname);
    if (parsed.protocol !== "https:" && !local) {
      errors.push(`${name} must use HTTPS outside local development`);
    }
    if (parsed.username || parsed.password) {
      errors.push(`${name} must not contain embedded credentials`);
    }
  } catch {
    errors.push(`${name} must be a valid absolute URL`);
  }
}

for (const warning of warnings) console.warn(`Warning: ${warning}`);

if (errors.length) {
  console.error("Environment validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  const enabled = Object.entries(featureGroups)
    .filter(([, names]) => names.every(value))
    .map(([name]) => name);
  console.log(
    `${production ? "Production" : "Development"} environment is valid. Optional features: ${enabled.join(", ") || "none"}.`,
  );
}
