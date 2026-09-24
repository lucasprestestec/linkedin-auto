"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { NAV_ITEMS, isActive } from "./navItems";
import { Brand } from "./Brand";
import { IconArrowUpRight, IconChevronLeft, IconDots, IconDownload, IconLogout, IconSparkles } from "./Icons";
import { useShell } from "./ShellContext";
import { initials, avatarGradient } from "@/lib/format";
import { logout } from "@/app/actions";

// Barra lateral escura do computador (≥1024px). Pode ser recolhida só pros ícones.
export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const { ownerName, unanswered } = useShell();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const name = ownerName ?? "Seu perfil";
  const [first, ...rest] = name.split(/\s+/);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  return (
    <aside className="sidebar" aria-label="Navegação principal">
      <div className="sidebar-top">
        <Brand size={38} className="sidebar-brand" />
        <button type="button" className="sidebar-collapse" onClick={onToggle} aria-label={collapsed ? "Expandir menu" : "Recolher menu"}>
          <IconChevronLeft size={18} />
        </button>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ href, label, Icon, badge }) => {
          const active = isActive(pathname, href);
          const count = badge === "unanswered" ? unanswered : 0;
          return (
            <Link key={href} href={href} className="sidebar-item" aria-current={active ? "page" : undefined} title={collapsed ? label : undefined}>
              <Icon size={21} strokeWidth={active ? 2.2 : 1.9} />
              <span className="sidebar-label">{label}</span>
              {count > 0 && <span className="sidebar-badge">{count > 99 ? "99+" : count}</span>}
            </Link>
          );
        })}
      </nav>

      <Link href="/prospect" className="sidebar-promo">
        <span className="promo-tag">
          <IconSparkles size={12} /> NOVO
        </span>
        <strong className="display promo-title">
          Mais
          <br />
          leads,
          <br />
          menos
          <br />
          esforço.
        </strong>
        <span className="promo-text">Conecte seu LinkedIn, defina seu público e deixe a IA trabalhar por você.</span>
        <span className="promo-arrow" aria-hidden="true">
          <IconArrowUpRight size={20} />
        </span>
      </Link>

      <div className="sidebar-user" ref={menuRef}>
        <Link href="/settings" className="sidebar-user-link">
          <span className="avatar" style={{ width: 40, height: 40, background: avatarGradient(name), fontSize: 14 }}>
            {initials(first, rest.at(-1))}
          </span>
          <span className="sidebar-label stack" style={{ minWidth: 0 }}>
            <strong className="truncate">{name}</strong>
            <small>Ver perfil</small>
          </span>
        </Link>
        <button type="button" className="sidebar-user-more" onClick={() => setMenuOpen((o) => !o)} aria-label="Mais opções" aria-expanded={menuOpen}>
          <IconDots size={18} />
        </button>
        {menuOpen && (
          <div className="popover popover-up" role="menu">
            <a href="/api/export/leads" download className="menu-item" role="menuitem">
              <IconDownload size={16} /> Exportar leads (CSV)
            </a>
            <form action={logout}>
              <button type="submit" className="menu-item" role="menuitem">
                <IconLogout size={16} /> Sair
              </button>
            </form>
          </div>
        )}
      </div>
    </aside>
  );
}
