"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import type { CampaignStatus } from "@prisma/client";
import { IconCheck, IconDots, IconSettings, IconTrash } from "@/components/Icons";
import { deleteCampaign, setCampaignStatus } from "./actions";

// "…" de uma campanha: pausar/retomar, finalizar, editar, apagar.
export function CampaignMenu({ id, name, status, leads }: { id: string; name: string; status: CampaignStatus; leads: number }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
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
    <div className="popover-anchor" ref={ref} onClick={(e) => e.preventDefault()}>
      <button type="button" className="kebab" aria-label={`Ações da campanha ${name}`} aria-expanded={open} disabled={pending} onClick={() => setOpen((o) => !o)}>
        <IconDots size={18} />
      </button>
      {open && (
        <div className="popover" role="menu" style={{ width: 220 }}>
          {status === "ACTIVE" ? (
            <button type="button" className="menu-item" role="menuitem" onClick={() => run(() => setCampaignStatus(id, "PAUSED"))}>
              ⏸ Pausar
            </button>
          ) : (
            <button type="button" className="menu-item" role="menuitem" onClick={() => run(() => setCampaignStatus(id, "ACTIVE"))}>
              ▶ {status === "PAUSED" ? "Retomar" : "Reativar"}
            </button>
          )}
          {status !== "FINISHED" && (
            <button type="button" className="menu-item" role="menuitem" onClick={() => run(() => setCampaignStatus(id, "FINISHED"))}>
              <IconCheck size={16} /> Finalizar
            </button>
          )}
          <Link href={`/campaigns/${id}/edit`} className="menu-item" role="menuitem">
            <IconSettings size={16} /> Editar
          </Link>
          <button
            type="button"
            className="menu-item danger"
            role="menuitem"
            onClick={() => {
              if (!confirm(`Apagar a campanha "${name}"?${leads ? ` As ${leads} pessoas dela continuam em Conversas.` : ""}`)) return;
              run(() => deleteCampaign(id));
            }}
          >
            <IconTrash size={16} /> Apagar
          </button>
        </div>
      )}
    </div>
  );
}
