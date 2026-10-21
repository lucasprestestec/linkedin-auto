"use client";

import { useState, useTransition } from "react";
import { Help } from "@/components/Help";
import { daysUntil, formatISO, renewalWhen, todayISO } from "@/lib/renewal";
import { resolveRenewal, setRenewal } from "./actions";

// Renovação do contrato desta pessoa (carteira de clientes). Entra na tela Hoje quando chega perto do vencimento.
export function LeadRenewal({ leadId, dueISO, note }: { leadId: string; dueISO: string | null; note: string | null }) {
  const [date, setDate] = useState(dueISO ? formatISO(dueISO) : "");
  const [text, setText] = useState(note ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const days = dueISO ? daysUntil(dueISO, todayISO()) : null;

  const run = (fn: () => Promise<{ error?: string }>, ok: string) => {
    setMsg(null);
    start(async () => {
      const r = await fn();
      setMsg(r.error ?? ok);
    });
  };

  return (
    <section className="sec">
      <h2 className="t-label">
        Renovação
        <Help>Quando o contrato desta pessoa vence. Faltando 60 dias, ela aparece na tela Hoje para você procurar antes de vencer.</Help>
      </h2>
      <div className="form" style={{ gap: 12 }}>
        {days != null && <p className="small" style={{ margin: 0 }}><b>{renewalWhen(days)}</b> ({formatISO(dueISO!)})</p>}
        <input className="field" value={date} onChange={(e) => setDate(e.target.value)} placeholder="Vencimento (ex.: 15/03/2027)" aria-label="Vencimento" inputMode="numeric" />
        <input className="field" value={text} onChange={(e) => setText(e.target.value)} placeholder="O que é (ex.: Seguro auto · Porto · apólice 123)" aria-label="O que vence" />
        <div className="form-actions">
          <button type="button" className="btn-solid btn-sm" disabled={pending} onClick={() => run(() => setRenewal(leadId, date, text), "Salvo.")}>
            {pending ? "Salvando…" : "Salvar"}
          </button>
          {dueISO && (
            <>
              <button type="button" className="btn-line btn-sm" disabled={pending} onClick={() => run(() => resolveRenewal(leadId, true), "Renovou. O vencimento andou um ano.")}>
                Renovou
              </button>
              <button type="button" className="btn-line btn-sm" disabled={pending} onClick={() => run(() => resolveRenewal(leadId, false), "Anotado. Saiu da lista de renovações.")}>
                Não vai renovar
              </button>
            </>
          )}
          {msg && <span className="muted small">{msg}</span>}
        </div>
      </div>
    </section>
  );
}
