"use client";

import { useEffect, useMemo, useState } from "react";

import Image from "next/image";

import { Box, ExternalLink, RefreshCw } from "lucide-react";

import { authFetch } from "@/lib/authFetch";

type ModelRequest = {
  modelId: string;

  productId: string;
  productName: string;

  category: string;
  image: string;

  storeId: string | null;
  storeName: string | null;

  requestedAt: string | null;

  processingStatus: string | null;

  processingError: string | null;

  sourcePath: string | null;

  highPath: string | null;
};

function requestStatus(request: ModelRequest) {
  const status = request.processingStatus?.toLowerCase() ?? "";

  if (status === "failed" || status === "error") {
    return {
      key: "error",
      label: "Алдаатай",
    };
  }

  if (status === "ready") {
    return {
      key: "ready",
      label: "Бэлэн",
    };
  }

  if (status === "processing" || status === "queued") {
    return {
      key: "processing",
      label: status === "queued" ? "Дараалалд" : "Боловсруулж байна",
    };
  }

  return {
    key: "requested",
    label: "Шинэ хүсэлт",
  };
}

export function AdminModelRequests({
  owner,
  onOpenProduct,
}: {
  owner: string;

  onOpenProduct: (productId: string) => void;
}) {
  const [requests, setRequests] = useState<ModelRequest[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    let active = true;

    setLoading(true);
    setError(null);

    authFetch(
      "/api/admin/models/requests",
      {
        signal: controller.signal,
      },
      owner,
    )
      .then(async (response) => {
        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(data?.error ?? "3D хүсэлтүүдийг ачаалж чадсангүй.");
        }

        return data;
      })
      .then((data) => {
        if (!active) return;

        setRequests(Array.isArray(data?.requests) ? data.requests : []);
      })
      .catch((reason) => {
        if (!active) return;

        setError(
          reason instanceof Error
            ? reason.message
            : "3D хүсэлтүүдийг ачаалж чадсангүй.",
        );
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [owner, refresh]);

  const stats = useMemo(() => {
    return requests.reduce(
      (result, request) => {
        const status = requestStatus(request).key;

        result[status as keyof typeof result] += 1;

        return result;
      },
      {
        requested: 0,
        processing: 0,
        ready: 0,
        error: 0,
      },
    );
  }, [requests]);

  return (
    <section className="admin-model-requests">
      <div className="admin-model-request-heading">
        <div>
          <span className="admin-eyebrow">MERCHANT REQUESTS</span>

          <h2>3D загварын хүсэлт</h2>

          <p>Merchant-аас 3D загварт оруулах хүсэлт өгсөн бүтээгдэхүүнүүд.</p>
        </div>

        <button
          type="button"
          className="btn-ghost"
          disabled={loading}
          onClick={() => setRefresh((value) => value + 1)}
        >
          <RefreshCw size={15} />
          Шинэчлэх
        </button>
      </div>

      <div className="admin-model-request-stats">
        <span>
          Шинэ
          <strong>{stats.requested}</strong>
        </span>

        <span>
          Processing
          <strong>{stats.processing}</strong>
        </span>

        <span>
          Ready
          <strong>{stats.ready}</strong>
        </span>

        <span>
          Error
          <strong>{stats.error}</strong>
        </span>
      </div>

      {loading ? (
        <div className="admin-loading">Хүсэлтүүдийг ачаалж байна…</div>
      ) : error ? (
        <p className="admin-error" role="alert">
          {error}
        </p>
      ) : !requests.length ? (
        <div className="admin-model-request-empty">
          <Box size={27} />

          <strong>Одоогоор 3D хүсэлт байхгүй</strong>
        </div>
      ) : (
        <div className="admin-model-request-list">
          {requests.map((request) => {
            const status = requestStatus(request);

            return (
              <article key={request.modelId} className="admin-model-request">
                {request.image ? (
                  <Image src={request.image} alt="" width={66} height={66} />
                ) : (
                  <div className="admin-model-request-placeholder">
                    <Box size={20} />
                  </div>
                )}

                <div className="admin-model-request-main">
                  <strong>{request.productName}</strong>

                  <small>{request.storeName ?? "Дэлгүүргүй"}</small>

                  {request.requestedAt && (
                    <small>
                      {new Date(request.requestedAt).toLocaleString("mn-MN", {
                        timeZone: "Asia/Ulaanbaatar",
                      })}
                    </small>
                  )}
                </div>

                <span className={`admin-model-request-status ${status.key}`}>
                  {status.label}
                </span>

                {request.processingError && (
                  <span
                    className="admin-model-request-error"
                    title={request.processingError}
                  >
                    {request.processingError}
                  </span>
                )}

                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => onOpenProduct(request.productId)}
                >
                  <ExternalLink size={14} />
                  Бараа нээх
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
