"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { IconRefresh } from "@/components/Icons";

export function RefreshStatusButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      className="btn btn-secondary btn-block btn-sm"
    >
      <IconRefresh size={15} style={pending ? { animation: "spin 0.8s linear infinite" } : undefined} />
      {pending ? "Atualizando…" : "Já entrei — atualizar status"}
    </button>
  );
}
