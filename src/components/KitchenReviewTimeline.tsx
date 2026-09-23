"use client";

import { Clock3, MessageSquareText } from "lucide-react";
import type {
  KitchenDesignSummary,
  KitchenDesignReviewStatus,
  KitchenReviewHistoryItem,
} from "@/lib/kitchenMarketplace";

const versionStatus: Record<KitchenDesignReviewStatus, string> = {
  draft: "Draft",
  submitted: "Хяналтад",
  changes_requested: "Засвар хүссэн",
  approved: "Зөвшөөрсөн",
  rejected: "Татгалзсан",
};
const reviewAction: Record<KitchenReviewHistoryItem["action"], string> = {
  approved: "Зөвшөөрсөн",
  changes_requested: "Засвар хүссэн",
  rejected: "Татгалзсан",
  unpublished: "Marketplace-с буулгасан",
};
const dateTime = (value: string) =>
  new Intl.DateTimeFormat("mn-MN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

export function KitchenReviewTimeline({
  design,
}: {
  design: KitchenDesignSummary;
}) {
  const versionNumber = new Map(
    design.versions.map((version) => [version.id, version.versionNo]),
  );
  const activeFeedback = (
    ["changes_requested", "rejected"] as string[]
  ).includes(design.reviewStatus)
    ? design.reviews.find(
        (review) =>
          review.versionId === design.versionId &&
          review.action === design.reviewStatus,
      )
    : undefined;
  return (
    <>
      {activeFeedback && (
        <div
          className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
          role="note"
        >
          <p className="flex items-center gap-2 font-medium">
            <MessageSquareText size={16} />
            Admin: {reviewAction[activeFeedback.action]}
          </p>
          <p className="mt-1 whitespace-pre-wrap">
            {activeFeedback.note || "Тайлбар оруулаагүй."}
          </p>
        </div>
      )}
      {(design.versions.length > 0 || design.reviews.length > 0) && (
        <details className="rounded-xl border border-black/10 p-3 text-sm">
          <summary className="cursor-pointer font-medium">
            Version ба review түүх ({design.versions.length})
          </summary>
          <div className="mt-3 space-y-4">
            <ol className="space-y-2">
              {design.versions.map((version) => (
                <li
                  key={version.id}
                  className="flex items-start justify-between gap-3 rounded-lg bg-black/[0.03] p-3"
                >
                  <div>
                    <p className="font-medium">
                      v{version.versionNo} · {version.title}
                    </p>
                    <p className="text-xs text-black/50">
                      {versionStatus[version.reviewStatus]}
                      {version.isPublished ? " · Marketplace дээр нийтэд" : ""}
                    </p>
                  </div>
                  <time
                    className="shrink-0 text-[11px] text-black/40"
                    dateTime={version.createdAt}
                  >
                    {dateTime(version.createdAt)}
                  </time>
                </li>
              ))}
            </ol>
            {design.reviews.length > 0 && (
              <div>
                <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-black/45">
                  <Clock3 size={14} />
                  Review timeline
                </h4>
                <ol className="space-y-3 border-l border-black/15 pl-4">
                  {design.reviews.map((review) => (
                    <li
                      key={review.id}
                      className="relative before:absolute before:-left-[21px] before:top-1.5 before:h-2 before:w-2 before:rounded-full before:bg-[#315b43]"
                    >
                      <p className="font-medium">
                        {reviewAction[review.action]}
                        {review.versionId && versionNumber.has(review.versionId)
                          ? ` · v${versionNumber.get(review.versionId)}`
                          : ""}
                      </p>
                      {review.note && (
                        <p className="mt-1 whitespace-pre-wrap text-black/65">
                          {review.note}
                        </p>
                      )}
                      <time
                        className="text-[11px] text-black/40"
                        dateTime={review.createdAt}
                      >
                        {dateTime(review.createdAt)}
                      </time>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </details>
      )}
    </>
  );
}
