"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { TagInput } from "@/components/TagInput";
import { Help } from "@/components/Help";
import type { CampaignFormState } from "./actions";
import { FollowUpOverride, type FollowUpValue } from "@/components/FollowUpFields";

const followUpShort = (v: FollowUpValue) =>
  v.count === 0 ? "Sem acompanhamento" : `${v.count} mensage${v.count > 1 ? "ns" : "m"} de acompanhamento, uma a cada ${v.days} dia${v.days > 1 ? "s" : ""}`;

const STEPS = ["Detalhes", "Público", "Mensagem", "Revisão"];

export interface CampaignDraft {
  name: string;
  description: string;
  audience: string[];
  instructions: string;
  maxLeads: string;
  // null = usa o padrão da conta
  followUp: FollowUpValue | null;
}

const EMPTY: CampaignDraft = { name: "", description: "", audience: [], instructions: "", maxLeads: "", followUp: null };

// Criar/editar campanha em 4 passos curtos. Tudo é enviado junto no final.
export function CampaignWizard({
  action,
  initial,
  cancelHref,
  submitLabel,
  accountFollowUp,
}: {
  action: (prev: CampaignFormState, formData: FormData) => Promise<CampaignFormState>;
  initial?: CampaignDraft;
  cancelHref: string;
  submitLabel: string;
  accountFollowUp: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [step, setStep] = useState(0);
  const [d, setD] = useState<CampaignDraft>(initial ?? EMPTY);
  const set = <K extends keyof CampaignDraft>(k: K, v: CampaignDraft[K]) => setD((p) => ({ ...p, [k]: v }));
  const canNext = step !== 0 || d.name.trim().length > 0;

  return (
    <form action={formAction} className="stack" style={{ gap: 16 }}>
      <input type="hidden" name="name" value={d.name} />
      <input type="hidden" name="description" value={d.description} />
      <input type="hidden" name="audience" value={JSON.stringify(d.audience)} />
      <input type="hidden" name="instructions" value={d.instructions} />
      <input type="hidden" name="maxLeads" value={d.maxLeads} />
      <input type="hidden" name="followUpCustom" value={d.followUp ? "1" : ""} />
      <input type="hidden" name="followUpCount" value={d.followUp?.count ?? ""} />
      <input type="hidden" name="followUpDays" value={d.followUp?.days ?? ""} />

      <div className="tabs" aria-label="Etapas">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            aria-pressed={i === step}
            aria-current={i === step ? "step" : undefined}
            onClick={() => (i < step || canNext ? setStep(i) : undefined)}
            disabled={i > step && !canNext}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      <div className="sec">
        {step === 0 && (
          <>
            <div>
              <label className="label">Nome da campanha</label>
              <input className="field" value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Saúde empresarial" maxLength={60} autoFocus />
            </div>
            <div>
              <label className="label">Descrição (opcional)</label>
              <textarea className="field" rows={4} value={d.description} onChange={(e) => set("description", e.target.value)} placeholder="Qual é o objetivo desta campanha?" maxLength={200} />
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div>
              <label className="label">
                Público-alvo <Help>Já vem preenchido na busca quando você for adicionar pessoas a esta campanha.</Help>
              </label>
              <TagInput
                label="Público-alvo"
                values={d.audience}
                onChange={(v) => set("audience", v)}
                placeholder="Cargo, setor ou empresa"
                suggestions={["Diretor de RH", "Sócio", "CFO", "Clínicas", "Advocacia", "Tecnologia"]}
              />
            </div>
            <div>
              <label className="label">
                Limite de pessoas (opcional) <Help>Depois de chegar nesse número, a campanha não recebe mais pessoas.</Help>
              </label>
              <input
                className="field"
                inputMode="numeric"
                value={d.maxLeads}
                onChange={(e) => set("maxLeads", e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="Ex.: 50"
                style={{ maxWidth: 160 }}
              />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <label className="label">
                Oferta ou mensagem principal <Help>Escreva do seu jeito. O assistente usa isso para conversar com as pessoas desta campanha.</Help>
              </label>
              <textarea
                className="field"
                rows={6}
                value={d.instructions}
                onChange={(e) => set("instructions", e.target.value)}
                placeholder="Ex.: Convite para conhecer nosso plano de saúde empresarial, com economia em relação ao plano atual. Se pedirem valores, passe para mim."
              />
            </div>
            <div>
              <label className="label">Acompanhamento</label>
              <FollowUpOverride custom={d.followUp} onChange={(v) => set("followUp", v)} inheritedLabel={accountFollowUp} idPrefix="fu-camp" />
            </div>
          </>
        )}

        {step === 3 && (
          <dl className="kv" style={{ gridTemplateColumns: "130px 1fr" }}>
            <dt>Nome</dt>
            <dd>{d.name || "—"}</dd>
            <dt>Descrição</dt>
            <dd>{d.description || "—"}</dd>
            <dt>Público-alvo</dt>
            <dd>{d.audience.length ? d.audience.join(", ") : "—"}</dd>
            <dt>Limite</dt>
            <dd>{d.maxLeads || "Sem limite"}</dd>
            <dt>Acompanhamento</dt>
            <dd>{d.followUp ? followUpShort(d.followUp) : `Padrão da conta (${accountFollowUp})`}</dd>
            <dt>Oferta</dt>
            <dd style={{ whiteSpace: "pre-line" }}>{d.instructions || "—"}</dd>
          </dl>
        )}

        {state?.error && <p className="field-error">{state.error}</p>}
      </div>

      <div className="row" style={{ justifyContent: "space-between" }}>
        {step === 0 ? (
          <Link href={cancelHref} className="btn-line">
            Cancelar
          </Link>
        ) : (
          <button type="button" className="btn-line" onClick={() => setStep(step - 1)}>
            Voltar
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button key="next" type="button" className="btn-solid" disabled={!canNext} onClick={() => setStep(step + 1)}>
            Continuar
          </button>
        ) : (
          <button key="submit" type="submit" className="btn-solid" disabled={pending || !d.name.trim()}>
            {pending ? "Salvando…" : submitLabel}
          </button>
        )}
      </div>
    </form>
  );
}
