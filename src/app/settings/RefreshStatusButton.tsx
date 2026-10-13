"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { IconRefresh } from "@/components/Icons";

export function RefreshStatusButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button type="button" onClick={() => startTransition(() => router.refresh())} disabled={pending} className="btn-text btn-quiet">
      <IconRefresh size={13} />
      {pending ? "Atualizando…" : "Já entrei, atualizar"}
    </button>
  );
}
