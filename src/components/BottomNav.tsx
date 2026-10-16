"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isActive } from "./navItems";
import { useShell } from "./ShellContext";

// Menu de baixo do celular: faixa preta de placas; a área aberta acende o seu quadrado de cor.
export function BottomNav() {
  const pathname = usePathname();
  const { needYouCount, draftCount } = useShell();

  return (
    <nav className="tabbar" aria-label="Navegação principal">
      {NAV_ITEMS.filter((item) => item.mobile).map((item) => {
        const { href, label, Icon, color } = item;
        const badge = "badge" in item ? item.badge : undefined;
        const count = badge === "attention" ? needYouCount : badge === "drafts" ? draftCount : 0;
        return (
          <Link key={href} href={href} className="tab" style={{ "--c": color } as React.CSSProperties} aria-current={isActive(pathname, item) ? "page" : undefined}>
            <span className="tab-icon">
              <Icon size={18} strokeWidth={2.2} />
              {count > 0 && <span className="tab-dot" />}
            </span>
            <span>{href === "/settings" ? "Mais" : label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
