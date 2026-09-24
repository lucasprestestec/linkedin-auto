"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";
  // Celular: a conversa tem o próprio compositor fixo no rodapé, sem menu.
  const hideBottomNav = isLogin || pathname.startsWith("/leads/");

  if (isLogin) return <>{children}</>;

  return (
    <div className="app">
      <Sidebar />
      <div className="shell">{children}</div>
      {!hideBottomNav && <BottomNav />}
    </div>
  );
}
