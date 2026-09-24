"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { ShellData } from "@/lib/shell";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";
import { DesktopTopbar } from "./DesktopTopbar";
import { ShellProvider } from "./ShellContext";

const COLLAPSE_KEY = "sidebar-collapsed";

export function AppShell({ children, data }: { children: React.ReactNode; data: ShellData | null }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";
  // Celular: a conversa tem o próprio compositor fixo no rodapé, sem menu.
  const hideBottomNav = isLogin || pathname.startsWith("/leads/");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      // Preferência do navegador; lida depois de montar pra não divergir na hidratação.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {}
  }, []);

  function toggle() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {}
      return !c;
    });
  }

  if (isLogin || !data) return <>{children}</>;

  return (
    <ShellProvider value={data}>
      <div className={`app${collapsed ? " app-collapsed" : ""}`}>
        <Sidebar collapsed={collapsed} onToggle={toggle} />
        <div className="shell">
          <Suspense>
            <DesktopTopbar />
          </Suspense>
          {children}
        </div>
        {!hideBottomNav && <BottomNav />}
      </div>
    </ShellProvider>
  );
}
