"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isActive } from "./navItems";
import { useShell } from "./ShellContext";

// Menu de baixo do celular: ícone pequeno e nome.
export function BottomNav() {
  const pathname = usePathname();
  const { needYouCount, draftCount } = useShell();

  return (
    <nav className="tabbar" aria-label="Navegação principal">
      {NAV_ITEMS.filter((item) => item.mobile).map(({ href, label, Icon, badge }) => {
        const count = badge === "attention" ? needYouCount : badge === "drafts" ? draftCount : 0;
        return (
          <Link key={href} href={href} className="tab" aria-current={isActive(pathname, href) ? "page" : undefined}>
            <span className="tab-icon">
              <Icon size={21} strokeWidth={1.7} />
              {count > 0 && <span className="tab-dot" />}
            </span>
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
