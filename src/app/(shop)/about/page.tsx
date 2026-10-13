import Image from "next/image";
import { MapPin, Phone, Clock, Mail } from "lucide-react";
import { STORE_LOCATIONS } from "@/lib/reviews";
import { SectionHeading } from "@/components/SectionHeading";

import { ContactForm } from "@/components/ContactForm";
import { SITE_CONTACT, phoneHref } from "@/lib/siteContact";

export const metadata = { title: "Бидний тухай —  tavilga.mn" };

export default function AboutPage() {
  return (
    <div className="ui-page">
      <section className="about-hero ui-panel">
        <div className="grid gap-8 md:grid-cols-2 md:gap-12">
            <div>
              <p className="ui-eyebrow mb-3">
                tavilga.mn-ийн тухай
              </p>
              <h1 className="text-5xl leading-[1.05] text-ui-ink">
                Эхлээд өрөөнд, дараа нь амьдралд тань тохирох тавилгыг бид
                хийдэг.
              </h1>
            </div>
            <div>
              <p className="text-lg text-ui-ink/80">
                tavilga.mn Хаалгаар орохгүй буйдан, өрөөнийхөө хэмжээнд
                таарахгүй хоолны ширээнд бид залхсан.
              </p>
              <p className="mt-4 text-ui-muted">
                Тиймээс бид өөр төрлийн худалдан авалтын арга олсон.
                Бүтээгдэхүүн бүр 3D загвартай. Өрөө бүр тээвэрлэгдэхээс өмнө
                төлөвлөгдөнө. Захиалга бүр маань бидний биечлэн мэддэг гар
                урчуудаар хийгдэнэ.
              </p>
            </div>
        </div>
      </section>

      <section className="about-section">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="ui-panel p-6 sm:p-8">
            <p className="ui-eyebrow mb-3">
              Эрхэм зорилго
            </p>
            <h2 className="ui-section-title">
              Хүмүүст гэрийнхээ талаар итгэлтэй, удаан хадгалагдах шийдвэр
              гаргахад туслах.
            </h2>
            <p className="mt-4 text-ui-muted">
              Тавилга бол ихэнх хүний амьдралд машин, гэр орны дараах хамгийн
              том худалдан авалтын нэг юм. Шилжүүлэхээсээ өмнө түүнийг харж,
              байрлуулж, виртуалаар амьдарч үзэх боломжтой байх ёстой гэж бид
              боддог.
            </p>
          </div>
          <div className="ui-panel p-6 sm:p-8">
            <p className="ui-eyebrow mb-3">
              Алсын хараа
            </p>
            <h2 className="ui-section-title">
              Эхлээд байрлуулаагүй ямар ч тавилга тээвэрлэгдэхгүй ертөнц.
            </h2>
            <p className="mt-4 text-ui-muted">
              Буцаалт хэрэглэгчийн цаг, дэлхийн байгаль, тээвэрлэгч түншүүдийн
              хувьд утаа алддаг. Өрөөний төлөвлөгч нь энэ тоог тэг рүү ойртуулах
              бидний арга юм.
            </p>
          </div>
        </div>
      </section>

      <section className="about-section">
        <div>
          <SectionHeading
            eyebrow="Тоогоор"
            title="Долоон жилд бид юу бүтээсэн бэ."
          />
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {[
              { n: "240+", l: "каталогт буй тавилга" },
              { n: "62мянга", l: "төлөвлөсөн өрөө" },
              { n: "4 хот", l: "дэлгүүртэй" },
              { n: "98%", l: "дахин худалдан авна" },
            ].map((s) => (
              <div
                key={s.l}
                className="ui-panel p-6 text-center sm:p-8"
              >
                <p className="text-3xl font-semibold tracking-tight text-ui-accent sm:text-4xl">{s.n}</p>
                <p className="mt-2 text-sm text-ui-muted">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="stores" className="about-section">
        <SectionHeading
          eyebrow="Биечлэн ирэх"
          title="Дэлгүүрийн байршил."
          body="Буйдан дээр сууж үзээрэй. Материалуудыг хүрч мэдрэх. Тэдгээрийг сайн мэддэг хүмүүстэй уулзах."
        />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {STORE_LOCATIONS.map((s) => (
            <div
              key={s.city}
              className="ui-panel overflow-hidden"
            >
              <div className="relative aspect-[4/3] bg-ui-bg">
                <Image
                  src={`https://images.unsplash.com/photo-${
                    s.city === "Улаанбаатар"
                      ? "1543589923-c44a4a2cffe0"
                      : s.city === "Дархан"
                        ? "1505873242700-f289a29e1e0f"
                        : s.city === "Эрдэнэт"
                          ? "1513519245088-0e12902e5a38"
                          : "1542051841857-5f90071e7989"
                  }?auto=format&fit=crop&w=600&q=80`}
                  alt={s.city}
                  fill
                  sizes="(max-width: 768px) 100vw, 25vw"
                  className="object-cover"
                />
              </div>
              <div className="p-5">
                <h3 className="text-xl text-ui-ink">{s.city}</h3>
                <ul className="mt-3 space-y-1.5 text-sm text-ui-muted">
                  <li className="flex gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-ui-accent" />
                    {s.address}
                  </li>
                  <li className="flex gap-2">
                    <Phone className="h-4 w-4 flex-shrink-0 text-ui-accent" />
                    <a href={phoneHref(s.phone)} className="hover:underline">{s.phone}</a>
                  </li>
                  <li className="flex gap-2">
                    <Clock className="h-4 w-4 flex-shrink-0 text-ui-accent" />
                    {s.hours}
                  </li>
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section
        id="contact"
        className="about-section about-contact ui-panel"
      >
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <p className="ui-eyebrow mb-3">Холбоо барих</p>
            <h2 className="ui-section-title">
              Сайн уу гэж хэлээрэй.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-7 text-ui-muted">
              Тавилгын талаар асуулт байна уу? Төлөвлөгчтэй холбоотой тусламж
              хэрэгтэй юу? Хамтран ажиллах хүсэлтэй юу? Бид мессеж бүрд
              хариулдаг.
            </p>
            <div className="mt-8 space-y-3 text-sm text-ui-ink">
              {SITE_CONTACT.email && <a href={`mailto:${SITE_CONTACT.email}`} className="flex items-center gap-3 break-all hover:underline">
                <Mail className="h-4 w-4 text-ui-accent" />{" "}
                {SITE_CONTACT.email}
              </a>}
              <a href={phoneHref(SITE_CONTACT.phone)} className="flex items-center gap-3 hover:underline">
                <Phone className="h-4 w-4 text-ui-accent" /> {SITE_CONTACT.phone}
              </a>
            </div>
          </div>
          <ContactForm />
        </div>
      </section>
    </div>
  );
}
