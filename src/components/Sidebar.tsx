"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isActive } from "./navItems";
import { Brand } from "./Brand";
import { useShell } from "./ShellContext";
import { ThemeToggle } from "./ThemeToggle";
import { useRootAttr } from "./useRootAttr";
import { IconLogOut, IconPanelLeft } from "./Icons";
import { SIDE_KEY } from "@/lib/prefs";
import { logout } from "@/app/actions";

// Menu lateral do computador (≥1024px). Pode ficar só com os ícones (a escolha fica guardada neste navegador).
export function Sidebar() {
  const pathname = usePathname();
  const { ownerName, needYouCount, draftCount } = useShell();
  const collapsed = useRootAttr("side") === "collapsed";

  function toggleCollapsed() {
    const next = !collapsed;
    if (next) document.documentElement.dataset.side = "collapsed";
    else delete document.documentElement.dataset.side;
    try {
      localStorage.setItem(SIDE_KEY, next ? "collapsed" : "open");
    } catch {}
  }

  return (
    <aside className="side" aria-label="Navegação principal">
      <div className="side-top">
        <Brand />
        <button type="button" className="icon-btn side-collapse" onClick={toggleCollapsed} aria-pressed={collapsed} aria-label={collapsed ? "Mostrar nomes do menu" : "Mostrar só os ícones"} title={collapsed ? "Mostrar nomes" : "Só ícones"}>
          <IconPanelLeft size={18} />
        </button>
      </div>

      <nav className="side-nav">
        {NAV_ITEMS.map(({ href, label, Icon, badge }) => {
          const count = badge === "attention" ? needYouCount : badge === "drafts" ? draftCount : 0;
          return (
            <Link key={href} href={href} className="side-link" title={label} aria-label={collapsed ? label : undefined} aria-current={isActive(pathname, href) ? "page" : undefined}>
              <span className="row" style={{ gap: 10 }}>
                <Icon size={18} strokeWidth={1.9} />
                <span className="side-label">{label}</span>
              </span>
              {count > 0 && <span className="side-count">{count > 99 ? "99+" : count}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="side-foot">
        <span className="side-who">{ownerName ?? "Sua conta"}</span>
        <div className="side-actions">
          <ThemeToggle />
          <form action={logout}>
            <button type="submit" className="icon-btn" aria-label="Sair" title="Sair">
              <IconLogOut size={18} />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
