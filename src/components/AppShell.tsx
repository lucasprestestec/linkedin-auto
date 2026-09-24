"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "./BottomNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Login é tela cheia; a conversa tem o próprio compositor fixo no rodapé.
  const hideNav = pathname === "/login" || pathname.startsWith("/leads/");

  return (
    <>
      <div className="shell">{children}</div>
      {!hideNav && <BottomNav />}
    </>
  );
}
