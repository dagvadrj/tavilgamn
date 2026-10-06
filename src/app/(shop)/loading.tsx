export default function ShopLoading() {
  return <div className="shop-container shop-route-loading" role="status" aria-live="polite">
    <span className="sr-only">Хуудсыг ачаалж байна…</span>
    <div className="shop-loading-title" />
    <div className="shop-loading-scene" />
    <div className="shop-loading-grid">{[0, 1, 2, 3].map(item => <div key={item} />)}</div>
  </div>;
}
