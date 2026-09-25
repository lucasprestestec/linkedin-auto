"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { NAV_ITEMS, isActive } from "./navItems";
import { Brand } from "./Brand";
import { IconBars, IconDots, IconDownload, IconLogout } from "./Icons";
import { useShell } from "./ShellContext";
import { initials, avatarGradient } from "@/lib/format";
import { logout } from "@/app/actions";

// Barra lateral escura do computador (≥1024px).
export function Sidebar() {
  const pathname = usePathname();
  const { ownerName, needYouCount } = useShell();
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
      <Brand size={30} className="sidebar-brand" />

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ href, label, Icon, badge }) => {
          const active = isActive(pathname, href);
          const count = badge === "attention" ? needYouCount : 0;
          return (
            <Link key={href} href={href} className="sidebar-item" aria-current={active ? "page" : undefined}>
              <Icon size={19} strokeWidth={active ? 2.2 : 1.9} />
              <span className="sidebar-label">{label}</span>
              {count > 0 && <span className="sidebar-badge">{count > 99 ? "99+" : count}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-tagline">
        <IconBars size={20} />
        <p>Seu crescimento começa com boas conversas.</p>
      </div>

      <div className="sidebar-user" ref={menuRef}>
        <Link href="/settings" className="sidebar-user-link">
          <span className="avatar" style={{ width: 34, height: 34, background: avatarGradient(name), fontSize: 12.5 }}>
            {initials(first, rest.at(-1))}
          </span>
          <span className="stack" style={{ minWidth: 0 }}>
            <strong className="truncate">{name}</strong>
            <small>Ver perfil</small>
          </span>
        </Link>
        <button type="button" className="sidebar-user-more" onClick={() => setMenuOpen((o) => !o)} aria-label="Mais opções" aria-expanded={menuOpen}>
          <IconDots size={16} />
        </button>
        {menuOpen && (
          <div className="popover popover-up" role="menu">
            <a href="/api/export/leads" download className="menu-item" role="menuitem">
              <IconDownload size={16} /> Baixar meus leads
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
