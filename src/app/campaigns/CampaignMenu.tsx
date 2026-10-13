"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import type { CampaignStatus } from "@prisma/client";
import { useConfirm } from "@/components/ConfirmDialog";
import { deleteCampaign, setCampaignStatus } from "./actions";

// "Mais" de uma campanha: pausar/retomar, finalizar, editar, apagar.
export function CampaignMenu({ id, name, status, leads }: { id: string; name: string; status: CampaignStatus; leads: number }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const { ask, dialog } = useConfirm();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function run(fn: () => Promise<unknown>) {
    setOpen(false);
    startTransition(async () => {
      await fn();
    });
  }

  return (
    <div className="menu-anchor" ref={ref} onClick={(e) => e.preventDefault()}>
      <button type="button" className="btn-line btn-sm" aria-label={`Ações da campanha ${name}`} aria-expanded={open} disabled={pending} onClick={() => setOpen((o) => !o)}>
        Mais
      </button>
      {open && (
        <div className="menu" role="menu">
          {status === "ACTIVE" ? (
            <button type="button" role="menuitem" onClick={() => run(() => setCampaignStatus(id, "PAUSED"))}>
              Pausar
            </button>
          ) : (
            <button type="button" role="menuitem" onClick={() => run(() => setCampaignStatus(id, "ACTIVE"))}>
              {status === "PAUSED" ? "Retomar" : "Reativar"}
            </button>
          )}
          {status !== "FINISHED" && (
            <button type="button" role="menuitem" onClick={() => run(() => setCampaignStatus(id, "FINISHED"))}>
              Finalizar
            </button>
          )}
          <Link href={`/campaigns/${id}/edit`} role="menuitem">
            Editar
          </Link>
          <button
            type="button"
            className="danger"
            role="menuitem"
            onClick={async () => {
              const ok = await ask({
                title: `Apagar a campanha "${name}"?`,
                message: leads ? `As ${leads} pessoas dela continuam em Conversas.` : "Ela ainda não tem ninguém.",
                confirmLabel: "Apagar a campanha",
                danger: true,
              });
              if (ok) run(() => deleteCampaign(id));
            }}
          >
            Apagar
          </button>
        </div>
      )}
      {dialog}
    </div>
  );
}
