"use client";

import Link from "next/link";
import { initials } from "@/lib/format";
import { useShell } from "./ShellContext";

// Círculo com as iniciais do corretor; leva à tela Conta.
export function HeaderUser() {
  const { ownerName } = useShell();
  const [first, ...rest] = (ownerName ?? "Você").split(/\s+/);
  return (
    <Link href="/settings" className="avatar" aria-label="Sua conta" style={{ width: 38, height: 38, fontSize: 14 }}>
      {initials(first, rest.at(-1))}
    </Link>
  );
}
