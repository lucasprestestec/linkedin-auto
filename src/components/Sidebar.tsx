"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isActive } from "./navItems";
import { Brand } from "./Brand";
import { useShell } from "./ShellContext";
import { logout } from "@/app/actions";

// Menu lateral do computador (≥1024px).
export function Sidebar() {
  const pathname = usePathname();
  const { ownerName, needYouCount, draftCount } = useShell();

  return (
    <aside className="side" aria-label="Navegação principal">
      <Brand />

      <nav className="side-nav">
        {NAV_ITEMS.map(({ href, label, Icon, badge }) => {
          const count = badge === "attention" ? needYouCount : badge === "drafts" ? draftCount : 0;
          return (
            <Link key={href} href={href} className="side-link" aria-current={isActive(pathname, href) ? "page" : undefined}>
              <span className="row" style={{ gap: 10 }}>
                <Icon size={18} strokeWidth={1.9} />
                {label}
              </span>
              {count > 0 && <span className="side-count">{count > 99 ? "99+" : count}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="side-foot">
        <span className="side-who">{ownerName ?? "Sua conta"}</span>
        <form action={logout}>
          <button type="submit" className="link-quiet">
            Sair
          </button>
        </form>
      </div>
    </aside>
  );
}
