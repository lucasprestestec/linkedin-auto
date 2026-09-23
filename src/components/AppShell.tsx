"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "./BottomNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideNav = pathname === "/login";

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, width: "100%", maxWidth: 640, margin: "0 auto" }}>{children}</div>
      {!hideNav && (
        <div style={{ width: "100%", maxWidth: 640, margin: "0 auto" }}>
          <BottomNav />
        </div>
      )}
    </div>
  );
}
