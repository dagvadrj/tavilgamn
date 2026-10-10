import { HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RETENTION_MS = 24 * 60 * 60 * 1000;
export function abandonedSourceKey(asset, bucket) {
  if (!UUID.test(asset.model_id) || !UUID.test(asset.version_id) || asset.role !== "source") return null;
  const key = `models/${asset.model_id}/source/${asset.version_id}.glb`;
  return asset.storage_path === `r2://${bucket}/${key}` ? key : null;
}

/** Only expired, never-accepted upload intents. Published GLB history is retained. */
export async function cleanupAbandonedSources(db, r2, bucket, { now = Date.now(), apply = false } = {}) {
  const cutoff = new Date(now - RETENTION_MS).toISOString();
  const result = { candidates: 0, deleted: 0, objectsDeleted: 0, missingReconciled: 0, skipped: 0, failed: 0 };
  let after = null;
  for (;;) {
    let query = db.from("model_assets").select("id,model_id,version_id,role,storage_path,state,sha256,validation,created_at,updated_at")
      .eq("role", "source").in("state", ["pending", "retired"])
      .is("sha256", null).is("validation", null).lt("created_at", cutoff).order("id").limit(100);
    if (after) query = query.gt("id", after);
    const { data: assets, error } = await query;
    if (error) throw error;
    for (const asset of assets ?? []) {
      try {
        const key = abandonedSourceKey(asset, bucket);
        if (!key || !["pending", "retired"].includes(asset.state) || asset.sha256 || asset.validation ||
          !(Date.parse(asset.created_at) < now - RETENTION_MS)) { result.skipped++; continue; }
        const referenced = async () => {
          const { data, error: referenceError } = await db.from("furniture_models").select("id")
            .eq("source_glb_path", asset.storage_path).limit(1);
          if (referenceError) throw referenceError;
          return Boolean(data?.length);
        };
        if (await referenced()) { result.skipped++; continue; }
        // A PUT may have happened after the intent: retain any object younger than 24 hours.
        let missing = false;
        try {
          const head = await r2.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
          if (!head.LastModified || head.LastModified.getTime() >= now - RETENTION_MS) { result.skipped++; continue; }
        } catch (headError) {
          if (headError?.$metadata?.httpStatusCode !== 404) throw headError;
          missing = true;
        }
        result.candidates++;
        if (!apply) continue;
        // CAS claims the intent before object deletion. queue_model_asset rejects retired
        // sources, so a concurrent upload-complete either wins first or is safely rejected.
        const { data: claimed, error: claimError } = await db.from("model_assets")
          .update({ state: "retired", updated_at: new Date(now).toISOString() })
          .eq("id", asset.id).eq("state", asset.state).eq("updated_at", asset.updated_at)
          .is("sha256", null).is("validation", null).select("id");
        if (claimError) throw claimError;
        if (claimed?.length !== 1 || await referenced()) { result.skipped++; continue; }
        if (!missing) await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
        const { error: ledgerError } = await db.from("model_assets")
          .update({ state: "deleted", updated_at: new Date(now).toISOString() })
          .eq("id", asset.id).eq("state", "retired").is("sha256", null);
        if (ledgerError) throw ledgerError;
        result.deleted++;
        if (missing) result.missingReconciled++;
        else result.objectsDeleted++;
      } catch (cleanupError) {
        result.failed++;
        console.error(`[source cleanup] ${asset.id}: ${cleanupError instanceof Error ? cleanupError.message : "cleanup failed"}`);
      }
    }
    if (!assets || assets.length < 100) return result;
    after = assets[assets.length - 1].id;
  }
}
