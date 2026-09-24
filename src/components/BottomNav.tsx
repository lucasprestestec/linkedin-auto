"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconChat, IconRadar, IconSliders } from "./Icons";

const items = [
  { href: "/", label: "Leads", Icon: IconChat },
  { href: "/prospect", label: "Prospecção", Icon: IconRadar },
  { href: "/settings", label: "Ajustes", Icon: IconSliders },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="nav" aria-label="Navegação principal">
      {items.map(({ href, label, Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link key={href} href={href} className="nav-item" aria-current={active ? "page" : undefined} aria-label={label}>
            <Icon size={22} strokeWidth={active ? 2.3 : 2} />
            <span className="nav-label">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
