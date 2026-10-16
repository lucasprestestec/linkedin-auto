"use client";

import Link from "next/link";
import { Avatar } from "./Avatar";
import { useShell } from "./ShellContext";

// Rosto da sua conta (bonequinho pelo primeiro nome); leva à tela Conta.
export function HeaderUser() {
  const { ownerName } = useShell();
  const [first, ...rest] = (ownerName ?? "").split(/\s+/);
  return (
    <Link href="/settings" aria-label="Sua conta" style={{ display: "inline-flex" }}>
      <Avatar firstName={first} lastName={rest.at(-1)} size={38} />
    </Link>
  );
}
