"use client";

import { usePathname } from "next/navigation";
import type { ShellData } from "@/lib/shell";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";
import { ShellProvider } from "./ShellContext";

export function AppShell({ children, data }: { children: React.ReactNode; data: ShellData | null }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";
  // Celular: a conversa tem o próprio compositor fixo no rodapé, sem menu.
  const hideBottomNav = isLogin || pathname.startsWith("/leads/");

  if (isLogin || !data) return <>{children}</>;

  return (
    <ShellProvider value={data}>
      <div className="frame">
        <Sidebar />
        <div className="frame-main">{children}</div>
        {!hideBottomNav && <BottomNav />}
      </div>
    </ShellProvider>
  );
}
