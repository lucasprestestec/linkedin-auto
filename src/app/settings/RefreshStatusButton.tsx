"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function RefreshStatusButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      style={{
        background: "none",
        border: "none",
        color: "var(--primary)",
        fontSize: 13,
        cursor: "pointer",
        padding: 0,
      }}
    >
      {pending ? "Atualizando..." : "Já entrei — atualizar status"}
    </button>
  );
}
