"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { MessageSquare, Star, Bot } from "lucide-react";
import { useAuth } from "@/store/auth";
import { authFetch } from "@/lib/authFetch";
import {
  answerFaq,
  feedbackFormMode,
  type Faq,
} from "@/lib/merchantOperations";
import "./store-feedback.css";

type PublicReview = {
  rating: number;
  body: string;
  photos: string[];
  reply: string;
  created_at: string;
};
type PublicFeedback = {
  reviews: PublicReview[];
  summary: { count: number; rating: number };
  assistant: { greeting: string; fallback: string; faqs: Faq[] } | null;
};
function usePublicFeedback(query: string) {
  const [result, setResult] = useState<{
      key: string;
      data?: PublicFeedback;
      error?: string;
    }>({ key: "" }),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    fetch(`/api/store-feedback?${query}`, {
      signal: c.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      })
      .then((data) => {
        if (!c.signal.aborted) setResult({ key: query, data });
      })
      .catch((e) => {
        if (!c.signal.aborted) setResult({ key: query, error: e.message });
      });
    return () => c.abort();
  }, [query, retry]);
  return {
    ...(result.key === query ? result : {}),
    retry: () => setRetry((v) => v + 1),
  };
}
export function PublishedProductReviews({ productId }: { productId: string }) {
  const r = usePublicFeedback(`product=${encodeURIComponent(productId)}`);
  if (r.error)
    return (
      <div className="store-feedback">
        <p role="alert">{r.error}</p>
        <button className="btn-ghost" onClick={r.retry}>
          Дахин шалгах
        </button>
      </div>
    );
  if (!r.data) return <p role="status">Сэтгэгдэл ачаалж байна…</p>;
  return (
    <div className="store-feedback">
      {r.data.summary.count > 0 ? (
        <>
          <div className="pdp-review-summary">
            <Star size={24} />
            <strong>{Number(r.data.summary.rating).toFixed(1)}</strong>
            <span>/ 5 · {r.data.summary.count} сэтгэгдэл</span>
          </div>
          {r.data.reviews.map((review, index) => (
            <article
              className="feedback-card"
              key={`${review.created_at}:${index}`}
            >
              <strong>{review.rating} / 5 · Баталгаатай худалдан авалт</strong>
              <small>
                {new Date(review.created_at).toLocaleDateString("mn-MN")}
              </small>
              <p>{review.body}</p>
              <FeedbackPhotos photos={review.photos} />
              {review.reply && (
                <blockquote>
                  <strong>Дэлгүүрийн хариу</strong>
                  <p>{review.reply}</p>
                </blockquote>
              )}
            </article>
          ))}
          {r.data.summary.count > 50 && (
            <p>Сүүлийн 50 сэтгэгдлийг харуулж байна.</p>
          )}
        </>
      ) : (
        <>
          <MessageSquare size={28} />
          <h2>Сэтгэгдэл хараахан байхгүй</h2>
          <p>
            Хүргэгдсэн захиалгынхаа дэлгэрэнгүйгээс үнэлгээ, зурагтай сэтгэгдэл
            үлдээгээрэй.
          </p>
        </>
      )}
    </div>
  );
}
export function StoreAssistant({ storeId }: { storeId: string }) {
  const r = usePublicFeedback(`store=${encodeURIComponent(storeId)}`),
    [question, setQuestion] = useState(""),
    [answer, setAnswer] = useState("");
  const settings = r.data?.assistant;
  if (!settings) return null;
  return (
    <details className="store-feedback store-assistant">
      <summary>
        <Bot size={20} />
        Дэлгүүрийн туслах · FAQ
      </summary>
      <div>
        <p>{settings.greeting}</p>
        <div className="feedback-faqs">
          {settings.faqs.map((faq, i) => (
            <button
              type="button"
              className="btn-ghost"
              key={i}
              onClick={() => {
                setQuestion(faq.question);
                setAnswer(faq.answer);
              }}
            >
              {faq.question}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setAnswer(answerFaq(question, settings.faqs, settings.fallback));
          }}
        >
          <label>
            Таны асуулт
            <input
              className="input"
              required
              maxLength={500}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </label>
          <button className="btn-primary">Асуух</button>
        </form>
        {answer && (
          <p className="feedback-answer" aria-live="polite">
            {answer}
          </p>
        )}
        <small>Дэлгүүрийн баталсан мэдээллээс хариулна.</small>
      </div>
    </details>
  );
}
function FeedbackPhotos({ photos }: { photos: string[] }) {
  return (
    <div className="feedback-photos">
      {photos.map((url, i) => (
        <a
          href={url}
          key={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Зураг ${i + 1} томруулах`}
        >
          <Image
            src={url}
            alt={`Хэрэглэгчийн зураг ${i + 1}`}
            width={128}
            height={128}
            unoptimized
          />
        </a>
      ))}
    </div>
  );
}
type RecordFeedback = {
  id: string;
  store_id: string;
  product_id?: string;
  kind?: string;
  status: string;
  reply: string;
  body?: string;
  reason?: string;
  photos: string[];
};
type OrderFeedback = {
  stores: {
    id: string;
    name: string;
    stage: string;
    items: { productId: string; name: string }[];
  }[];
  reviews: RecordFeedback[];
  cases: RecordFeedback[];
};
const STATUS: Record<string, string> = {
  pending: "Батлах хүлээгдэж буй",
  approved: "Нийтэлсэн",
  rejected: "Татгалзсан",
  requested: "Хүсэлт хүлээн авсан",
  reviewing: "Шалгаж байгаа",
  returned: "Бараа буцаасан",
  resolved: "Шийдвэрлэсэн",
};
export function CustomerStoreFeedback({ orderId }: { orderId: string }) {
  const owner = useAuth((s) => s.user?.id),
    [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    key: string;
    data?: OrderFeedback;
    error?: string;
  }>({ key: "" });
  const key = `${owner}:${orderId}`;
  useEffect(() => {
    const c = new AbortController();
    setState({ key });
    if (owner)
      authFetch(`/api/orders/${orderId}/feedback`, { signal: c.signal }, owner)
        .then(async (r) => {
          const d = await r.json();
          if (!r.ok) throw new Error(d.error);
          return d;
        })
        .then((data) => {
          if (!c.signal.aborted) setState({ key, data });
        })
        .catch((e) => {
          if (!c.signal.aborted) setState({ key, error: e.message });
        });
    return () => c.abort();
  }, [owner, orderId, revision, key]);
  if (!owner) return null;
  const data = state.key === key ? state.data : undefined;
  if (state.error)
    return (
      <div className="store-feedback">
        <p role="alert">{state.error}</p>
        <button className="btn-ghost" onClick={() => setRevision((v) => v + 1)}>
          Дахин шалгах
        </button>
      </div>
    );
  if (!data) return <p role="status">Дэлгүүрийн хүсэлтүүдийг ачаалж байна…</p>;
  const eligible = data.stores.filter((s) =>
    ["shipped", "delivered", "completed"].includes(s.stage),
  );
  if (!eligible.length && !data.cases.length && !data.reviews.length)
    return null;
  return (
    <section className="store-feedback order-feedback">
      <h2>Сэтгэгдэл, буцаалт ба гомдол</h2>
      {[...data.cases, ...data.reviews].map((row) => (
        <article className="feedback-card" key={row.id}>
          <strong>
            {row.kind
              ? row.kind === "return"
                ? "Буцаах хүсэлт"
                : "Гомдол"
              : "Таны сэтгэгдэл"}{" "}
            · {STATUS[row.status]}
          </strong>
          <p>{row.body ?? row.reason}</p>
          <FeedbackPhotos photos={row.photos} />
          {row.reply && (
            <blockquote>
              <strong>Дэлгүүрийн хариу</strong>
              <p>{row.reply}</p>
            </blockquote>
          )}
        </article>
      ))}
      {eligible.map((store) => (
        <CustomerFeedbackForm
          key={`${store.id}:${revision}`}
          orderId={orderId}
          owner={owner}
          store={store}
          data={data}
          onSaved={() => setRevision((v) => v + 1)}
        />
      ))}
    </section>
  );
}
function CustomerFeedbackForm({
  orderId,
  owner,
  store,
  data,
  onSaved,
}: {
  orderId: string;
  owner: string;
  store: OrderFeedback["stores"][number];
  data: OrderFeedback;
  onSaved: () => void;
}) {
  const products = store.items.filter(
    (p, i, items) =>
      items.findIndex((x) => x.productId === p.productId) === i &&
      !data.reviews.some(
        (r) => r.store_id === store.id && r.product_id === p.productId,
      ),
  );
  const canReview = store.stage !== "shipped" && products.length > 0,
    canCase = !data.cases.some((c) => c.store_id === store.id);
  const [requestedMode, setMode] = useState(canReview ? "review" : "case"),
    [kind, setKind] = useState("return"),
    [productId, setProductId] = useState(products[0]?.productId ?? "");
  const [rating, setRating] = useState("5"),
    [body, setBody] = useState(""),
    [photos, setPhotos] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const pending = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const current = () =>
    mounted.current && useAuth.getState().user?.id === owner;
  const mode = feedbackFormMode(requestedMode, canReview, canCase);
  const selectedProductId = products.some((p) => p.productId === productId)
    ? productId
    : (products[0]?.productId ?? "");
  if (!canReview && !canCase) return null;
  return (
    <details className="feedback-card">
      <summary>
        {store.name} ·{" "}
        {canReview ? "Сэтгэгдэл / Хүсэлт нэмэх" : "Буцаалт, гомдол гаргах"}
      </summary>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (pending.current) return;
          pending.current = true;
          setBusy(true);
          setError("");
          try {
            const response = await authFetch(
              `/api/orders/${orderId}/feedback`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: mode,
                  data: {
                    storeId: store.id,
                    productId: selectedProductId,
                    rating: Number(rating),
                    body,
                    kind,
                    reason: body,
                    photos,
                  },
                }),
              },
              owner,
            );
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            if (current()) onSaved();
          } catch (e) {
            if (current())
              setError(e instanceof Error ? e.message : "Илгээсэнгүй.");
          } finally {
            pending.current = false;
            if (current()) setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy}>
          <label>
            Төрөл
            <select
              className="input"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              {canReview && (
                <option value="review">Бараанд сэтгэгдэл үлдээх</option>
              )}
              {canCase && <option value="case">Буцаалт / Гомдол</option>}
            </select>
          </label>
          {mode === "review" ? (
            <>
              <label>
                Бараа
                <select
                  className="input"
                  required
                  value={selectedProductId}
                  onChange={(e) => setProductId(e.target.value)}
                >
                  {products.map((p) => (
                    <option key={p.productId} value={p.productId}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Үнэлгээ
                <select
                  className="input"
                  value={rating}
                  onChange={(e) => setRating(e.target.value)}
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} / 5
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <label>
              Хүсэлт
              <select
                className="input"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                <option value="return">Бараа буцаах</option>
                <option value="complaint">Гомдол / Тээвэрлэлтийн гэмтэл</option>
              </select>
            </label>
          )}
          <label>
            {mode === "review" ? "Сэтгэгдэл" : "Шалтгаан, тайлбар"}
            <textarea
              className="input"
              required
              minLength={5}
              maxLength={2000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          <label>
            Бодит зураг ({photos.length} / 4)
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={photos.length >= 4}
              onChange={async (e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (!files.length || pending.current) return;
                if (
                  files.length + photos.length > 4 ||
                  files.some((f) => f.size > 5 * 1024 * 1024)
                ) {
                  setError(
                    "4 хүртэл JPG/PNG/WebP зураг, тус бүр 5 MB-аас ихгүй сонгоно уу.",
                  );
                  return;
                }
                pending.current = true;
                setBusy(true);
                setError("");
                try {
                  for (const file of files) {
                    const form = new FormData();
                    form.set("file", file);
                    const response = await authFetch(
                      `/api/orders/${orderId}/feedback/images`,
                      { method: "POST", body: form },
                      owner,
                    );
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.error);
                    if (current()) setPhotos((p) => [...p, result.url]);
                  }
                } catch (e) {
                  if (current())
                    setError(
                      e instanceof Error ? e.message : "Зураг оруулаагүй.",
                    );
                } finally {
                  pending.current = false;
                  if (current()) setBusy(false);
                }
              }}
            />
          </label>
          <div className="feedback-photos">
            {photos.map((url, i) => (
              <div key={url}>
                <Image
                  src={url}
                  width={100}
                  height={100}
                  alt={`Сонгосон зураг ${i + 1}`}
                  unoptimized
                />
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setPhotos((p) => p.filter((x) => x !== url))}
                >
                  Хасах
                </button>
              </div>
            ))}
          </div>
          <p>
            {mode === "review"
              ? "Дэлгүүр баталсны дараа нийтэд харагдана."
              : "Хүсэлт нь шууд мөнгө буцаахгүй. Дэлгүүр таны хүсэлтийг шалгаж хариулна."}
          </p>
          <button className="btn-primary">
            {busy ? "Хадгалж байна…" : "Илгээх"}
          </button>
        </fieldset>
        {error && <p role="alert">{error}</p>}
      </form>
    </details>
  );
}
