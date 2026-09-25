"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isActive } from "./navItems";
import { useShell } from "./ShellContext";

export function BottomNav() {
  const pathname = usePathname();
  const { needYouCount } = useShell();

  return (
    <nav className="nav" aria-label="Navegação principal">
      {NAV_ITEMS.map(({ href, label, Icon, badge }) => {
        const active = isActive(pathname, href);
        const count = badge === "attention" ? needYouCount : 0;
        return (
          <Link key={href} href={href} className="nav-item" aria-current={active ? "page" : undefined}>
            <span className="nav-icon">
              <Icon size={23} strokeWidth={active ? 2.3 : 1.9} />
              {count > 0 && <span className="nav-badge">{count > 9 ? "9+" : count}</span>}
            </span>
            <span className="nav-label">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
