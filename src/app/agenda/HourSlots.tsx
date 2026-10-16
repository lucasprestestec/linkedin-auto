"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { HourSlot } from "@/lib/hourBlocks";
import { toggleHourBlock } from "./actions";

// Horas do expediente de cada dia: toque para bloquear (o assistente deixa de oferecer) ou liberar de novo.
export function HourSlots({ days }: { days: { key: string; label: string; hours: HourSlot[] }[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggle(h: HourSlot) {
    setError(null);
    setWorking(h.iso);
    startTransition(async () => {
      const r = await toggleHourBlock(h.iso, h.blockId);
      if (r.error) setError(r.error);
      router.refresh();
      setWorking(null);
    });
  }

  return (
    <>
      {days.map((d) => (
        <div key={d.key} className="slots-day">
          <b>{d.label}</b>
          <span className="slots">
            {d.hours.map((h) => (
              <button
                key={h.iso}
                type="button"
                className={`sl sl-${h.state}`}
                aria-pressed={h.state === "blocked"}
                disabled={h.state === "busy" || pending}
                title={h.state === "busy" ? "Já tem compromisso na agenda" : h.state === "blocked" ? "Bloqueado: toque para liberar" : "Livre: toque para bloquear"}
                onClick={() => toggle(h)}
              >
                {working === h.iso ? "…" : h.label}
              </button>
            ))}
          </span>
        </div>
      ))}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <p className="small muted">
        <span className="sl-key sl-free" /> livre · <span className="sl-key sl-blocked" /> bloqueado por você · <span className="sl-key sl-busy" /> compromisso
      </p>
    </>
  );
}
