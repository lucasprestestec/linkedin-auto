"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isActive } from "./navItems";
import { IconDownload, LogoMark } from "./Icons";

// Barra lateral fixa do computador — só aparece a partir de 1024px (CSS).
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar" aria-label="Navegação principal">
      <Link href="/" className="sidebar-brand">
        <span className="logo" style={{ width: 38, height: 38, borderRadius: 12 }}>
          <LogoMark size={22} />
        </span>
        <span className="stack">
          <strong>LinkedIn Leads</strong>
          <span>Prospecção com IA</span>
        </span>
      </Link>

      <nav className="sidebar-nav">
        <span className="sidebar-section">Menu</span>
        {NAV_ITEMS.map(({ href, label, Icon, hint }) => {
          const active = isActive(pathname, href);
          return (
            <Link key={href} href={href} className="sidebar-item" aria-current={active ? "page" : undefined}>
              <Icon size={20} strokeWidth={active ? 2.3 : 2} />
              <span className="stack">
                <span>{label}</span>
                <small>{hint}</small>
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-foot">
        <a href="/api/export/leads" className="sidebar-item" download>
          <IconDownload size={18} />
          <span>Exportar CSV</span>
        </a>
        <span className="sidebar-version">v0.2 · automação via edges.run</span>
      </div>
    </aside>
  );
}
