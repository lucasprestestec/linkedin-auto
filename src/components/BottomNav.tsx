"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isActive } from "./navItems";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="nav" aria-label="Navegação principal">
      {NAV_ITEMS.map(({ href, label, Icon }) => {
        const active = isActive(pathname, href);
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
