import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Image as ImageIcon, MapPin } from "lucide-react";

export function DirectoryCard({ href, title, image, badge, eyebrow, description, location, tags, summary, action }: {
  href: string; title: string; image?: string | null; badge: string; eyebrow?: string;
  description: string; location?: string; tags: string[];
  summary: { label: string; value: string; note?: string }; action: string;
}) {
  return <article className="directory-card directory-card-unified">
    <Link href={href} className="directory-card-photo" aria-label={`${title} — ${action}`}>
      {image ? <Image src={image} alt="" fill unoptimized sizes="(max-width: 639px) 100vw, (max-width: 959px) 50vw, 33vw" className="object-cover"/>
        : <ImageIcon size={36} aria-hidden="true"/>}
      <span className="directory-card-badge">{badge}</span>
      <span className="directory-card-arrow" aria-hidden="true"><ArrowUpRight size={19}/></span>
    </Link>
    <div className="directory-card-body">
      {eyebrow && <p className="directory-card-eyebrow">{eyebrow}</p>}
      <h2><Link href={href}>{title}</Link></h2>
      {location && <p className="directory-card-location"><MapPin size={14} aria-hidden="true"/>{location}</p>}
      <p className="directory-card-description">{description}</p>
      <div className="directory-card-tags">{tags.map(tag => <span key={tag}>{tag}</span>)}</div>
      <div className="directory-card-summary"><div><small>{summary.label}</small><strong>{summary.value}</strong></div>{summary.note && <span>{summary.note}</span>}</div>
      <Link href={href} className="directory-card-cta">{action}<ArrowUpRight size={17} aria-hidden="true"/></Link>
    </div>
  </article>;
}
