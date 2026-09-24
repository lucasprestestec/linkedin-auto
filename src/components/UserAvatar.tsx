"use client";

import Link from "next/link";
import { initials, avatarGradient } from "@/lib/format";
import { useShell } from "./ShellContext";

// Avatar do corretor (iniciais do nome configurado em Ajustes).
export function UserAvatar({ size = 44 }: { size?: number }) {
  const { ownerName } = useShell();
  const [first, ...rest] = (ownerName ?? "Você").split(/\s+/);
  return (
    <Link
      href="/settings"
      className="avatar user-avatar"
      aria-label="Seu perfil e ajustes"
      style={{ width: size, height: size, background: avatarGradient(ownerName ?? "Você"), fontSize: Math.round(size * 0.36) }}
    >
      {initials(first, rest.at(-1))}
    </Link>
  );
}
