"use client";

import { useState, useTransition } from "react";
import { Help } from "@/components/Help";
import type { DealStage } from "@prisma/client";
import { DEAL_LABEL } from "@/lib/deal";
import { setDeal } from "./actions";

// O que aconteceu depois da reunião. Alimenta o painel: quais campanhas geram proposta e venda.
export function LeadDeal({ leadId, stage, valueCents, reason }: { leadId: string; stage: DealStage | null; valueCents: number | null; reason: string | null }) {
  const [form, setForm] = useState({ stage: stage ?? "", value: valueCents == null ? "" : (valueCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }), reason: reason ?? "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const money = form.stage === "PROPOSAL" || form.stage === "WON" || form.stage === "LOST";

  function save() {
    setMsg(null);
    start(async () => {
      const r = await setDeal(leadId, form.stage, form.value, form.reason);
      setMsg(r.error ?? "Salvo.");
    });
  }

  return (
    <section className="sec">
      <h2 className="t-label">
        Resultado
        <Help>Depois da reunião, registre o que aconteceu. Com o valor das propostas e vendas, o painel mostra quais campanhas dão resultado.</Help>
      </h2>
      <div className="form" style={{ gap: 12 }}>
        <select className="field" value={form.stage} aria-label="Resultado" onChange={(e) => setForm({ ...form, stage: e.target.value as DealStage | "" })}>
          <option value="">Ainda sem resultado</option>
          {(Object.keys(DEAL_LABEL) as DealStage[]).map((s) => (
            <option key={s} value={s}>
              {DEAL_LABEL[s]}
            </option>
          ))}
        </select>
        {money && <input className="field" inputMode="decimal" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="Valor em R$ (opcional)" aria-label="Valor" />}
        {(form.stage === "LOST" || form.stage === "NO_SHOW") && <input className="field" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Motivo (opcional)" aria-label="Motivo" />}
        <div className="form-actions">
          <button type="button" className="btn-solid btn-sm" onClick={save} disabled={pending}>
            {pending ? "Salvando…" : "Salvar resultado"}
          </button>
          {msg && <span className="muted small">{msg}</span>}
        </div>
      </div>
    </section>
  );
}
