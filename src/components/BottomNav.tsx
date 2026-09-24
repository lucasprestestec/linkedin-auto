"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NAV_ITEMS, isActive } from "./navItems";
import { IconDots, IconDownload, IconLogout, IconMegaphone, IconSettings, IconX } from "./Icons";
import { useShell } from "./ShellContext";
import { logout } from "@/app/actions";

export function BottomNav() {
  const pathname = usePathname();
  const { unanswered } = useShell();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = pathname.startsWith("/settings");

  return (
    <>
      <nav className="nav" aria-label="Navegação principal">
        {NAV_ITEMS.filter((i) => i.mobile).map(({ href, label, Icon, badge }) => {
          const active = isActive(pathname, href);
          const count = badge === "unanswered" ? unanswered : 0;
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
        <button type="button" className="nav-item" aria-current={moreActive ? "page" : undefined} aria-expanded={moreOpen} onClick={() => setMoreOpen(true)}>
          <span className="nav-icon">
            <IconDots size={23} strokeWidth={2.2} />
          </span>
          <span className="nav-label">Mais</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="sheet-backdrop" onClick={() => setMoreOpen(false)}>
          <div className="sheet" role="dialog" aria-label="Mais opções" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <strong>Mais</strong>
              <button type="button" className="round-btn" onClick={() => setMoreOpen(false)} aria-label="Fechar">
                <IconX size={18} />
              </button>
            </div>
            <Link href="/settings" className="menu-item" onClick={() => setMoreOpen(false)}>
              <IconSettings size={18} /> Configurações
            </Link>
            <Link href="/settings#campanhas" className="menu-item" onClick={() => setMoreOpen(false)}>
              <IconMegaphone size={18} /> Campanhas
            </Link>
            <a href="/api/export/leads" download className="menu-item">
              <IconDownload size={18} /> Exportar leads (CSV)
            </a>
            <form action={logout}>
              <button type="submit" className="menu-item">
                <IconLogout size={18} /> Sair
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
