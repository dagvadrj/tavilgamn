import { createClient } from "@supabase/supabase-js";
import { S3Client } from "@aws-sdk/client-s3";
import { cleanupAbandonedSources } from "./cleanup-abandoned-sources.mjs";

const required = name => {
  if (!process.env[name]) throw new Error(`Missing environment variable: ${name}`);
  return process.env[name];
};
const db = createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("SUPABASE_SECRET_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const r2 = new S3Client({ region: "auto", endpoint: `https://${required("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: required("R2_ACCESS_KEY_ID"), secretAccessKey: required("R2_SECRET_ACCESS_KEY") } });
const apply = process.argv.includes("--apply");
try {
  const result = await cleanupAbandonedSources(db, r2, required("R2_BUCKET_NAME"), { apply });
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", retentionHours: 24, ...result }));
  if (result.failed) process.exitCode = 1;
} finally { r2.destroy(); }
