import Link from "next/link";
import { ArrowLeft, Armchair, Check, Layers3, Store } from "lucide-react";

export function AuthFrame({
  children,
  destination = "/account",
}: {
  children: React.ReactNode;
  destination?: string;
}) {
  const management =
    destination.startsWith("/merchant") || destination.startsWith("/admin");
  return (
    <main id="main-content" className="auth-page">
      <header className="auth-page-header">
        <Link
          href="/"
          className="auth-brand"
          aria-label="TAVILGA — нүүр хуудас"
        >
          TAVILGA<span aria-hidden="true">●</span>
        </Link>
        <Link href="/" className="auth-back">
          <ArrowLeft size={16} /> Нүүр хуудас
        </Link>
      </header>
      <div className="auth-content">
        <aside
          className="auth-story"
          aria-label={management ? "Удирдлагын бүртгэл" : "TAVILGA бүртгэл"}
        >
          <span className="auth-story-icon">
            {management ? <Store size={32} /> : <Armchair size={32} />}
          </span>
          <p className="auth-eyebrow">
            {management ? "ДЭЛГҮҮРИЙН УДИРДЛАГА" : "ТАНЫ ГЭР, ТАНЫ СОНГОЛТ"}
          </p>
          <h2>
            {management ? (
              <>
                Таны бизнес.
                <br />
                Нэг самбар.
              </>
            ) : (
              <>
                Гэрээ төсөөл.
                <br />
                Загвараа бүтээ.
              </>
            )}
          </h2>
          <p>
            {management
              ? "Бүтээгдэхүүн, захиалга, дэлгүүрийн мэдээллээ нэг дороос удирдаарай."
              : "Тавилгаа сонгож, өрөөгөө 3D орчинд төлөвлөж, дуртай загваруудаа хадгалаарай."}
          </p>
          <ul className="auth-benefits">
            <li>
              <Check size={18} />{" "}
              {management
                ? "Борлуулалт, захиалгын нэгдсэн мэдээлэл"
                : "Хадгалсан тавилга, өрөөний загварууд"}
            </li>
            <li>
              <Check size={18} />{" "}
              {management
                ? "Дэлгүүрийн тусдаа ажлын орчин"
                : "Захиалгын явцыг хялбархан хянах"}
            </li>
            <li>
              <Check size={18} /> Google, Apple эсвэл имэйлээр нэвтрэх
            </li>
          </ul>
          <div className="auth-story-foot">
            <Layers3 size={18} /> TAVILGA · Төсөөллөөс бодит гэрт
          </div>
        </aside>
        <div className="auth-form-panel">{children}</div>
      </div>
      <footer className="auth-page-footer">
        © {new Date().getFullYear()} TAVILGA{" "}
        <Link href="/about#contact">Тусламж авах</Link>
      </footer>
    </main>
  );
}
