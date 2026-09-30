"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function RefreshStatusButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button type="button" onClick={() => startTransition(() => router.refresh())} disabled={pending} className="btn-line">
      {pending ? "Atualizando…" : "Já entrei, atualizar"}
    </button>
  );
}
