import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function DirectoryHeading({ title, eyebrow, description, action }: {
  title: string; eyebrow: string; description: string; action?: { href: string; label: string };
}) {
  return <>
    <nav aria-label="Хуудасны зам" className="breadcrumbs"><Link href="/">Нүүр</Link><span>/</span><span>{title}</span></nav>
    <header className="directory-heading">
      <div><p className="directory-eyebrow">{eyebrow}</p><h1>{title}</h1><p className="directory-description">{description}</p></div>
      {action && <Link className="directory-action" href={action.href}>{action.label}<ArrowUpRight size={17} aria-hidden="true"/></Link>}
    </header>
  </>;
}
