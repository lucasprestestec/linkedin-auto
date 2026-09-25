"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { TagInput } from "@/components/TagInput";
import { IconAlert, IconArrowLeft, IconArrowRight, IconCheck, IconHash, IconMessages, IconUser } from "@/components/Icons";
import type { CampaignFormState } from "./actions";

const STEPS = ["Detalhes", "Público", "Mensagem", "Revisão"];

export interface CampaignDraft {
  name: string;
  description: string;
  audience: string[];
  instructions: string;
  maxLeads: string;
}

const EMPTY: CampaignDraft = { name: "", description: "", audience: [], instructions: "", maxLeads: "" };

// Criar/editar campanha em 4 passos curtos. Tudo é enviado junto no final.
export function CampaignWizard({
  action,
  initial,
  cancelHref,
  submitLabel,
}: {
  action: (prev: CampaignFormState, formData: FormData) => Promise<CampaignFormState>;
  initial?: CampaignDraft;
  cancelHref: string;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [step, setStep] = useState(0);
  const [d, setD] = useState<CampaignDraft>(initial ?? EMPTY);
  const set = <K extends keyof CampaignDraft>(k: K, v: CampaignDraft[K]) => setD((p) => ({ ...p, [k]: v }));
  const canNext = step !== 0 || d.name.trim().length > 0;

  return (
    <form action={formAction} className="wizard">
      <input type="hidden" name="name" value={d.name} />
      <input type="hidden" name="description" value={d.description} />
      <input type="hidden" name="audience" value={JSON.stringify(d.audience)} />
      <input type="hidden" name="instructions" value={d.instructions} />
      <input type="hidden" name="maxLeads" value={d.maxLeads} />

      <ol className="wizard-steps" aria-label="Etapas">
        {STEPS.map((label, i) => (
          <li key={label} className={i === step ? "current" : i < step ? "done" : undefined} aria-current={i === step ? "step" : undefined}>
            <button type="button" onClick={() => (i < step || canNext ? setStep(i) : undefined)} disabled={i > step && !canNext}>
              <span className="wizard-num">{i < step ? <IconCheck size={14} strokeWidth={3} /> : i + 1}</span>
              <span className="wizard-label">{label}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="wizard-body">
        {step === 0 && (
          <>
            <label className="wfield">
              <span>Nome da campanha</span>
              <span className="winput">
                <IconHash size={17} />
                <input value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Saúde empresarial" maxLength={60} autoFocus />
              </span>
            </label>
            <label className="wfield">
              <span>
                Descrição <em>(opcional)</em>
              </span>
              <textarea className="wtext" rows={4} value={d.description} onChange={(e) => set("description", e.target.value)} placeholder="Qual é o objetivo desta campanha?" maxLength={200} />
            </label>
          </>
        )}

        {step === 1 && (
          <>
            <div className="wfield">
              <span>Público-alvo</span>
              <TagInput
                label="Público-alvo"
                values={d.audience}
                onChange={(v) => set("audience", v)}
                placeholder="Cargo, setor ou empresa"
                suggestions={["Diretor de RH", "Sócio", "CFO", "Clínicas", "Advocacia", "Tecnologia"]}
              />
              <p className="hint">Já vem preenchido na busca quando você for adicionar pessoas a esta campanha.</p>
            </div>
            <label className="wfield">
              <span>
                Limite de leads <em>(opcional)</em>
              </span>
              <span className="winput">
                <IconUser size={17} />
                <input inputMode="numeric" value={d.maxLeads} onChange={(e) => set("maxLeads", e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="Ex.: 50" />
              </span>
              <p className="hint">Depois de chegar nesse número, a campanha não recebe mais pessoas.</p>
            </label>
          </>
        )}

        {step === 2 && (
          <label className="wfield">
            <span>Oferta ou mensagem principal</span>
            <span className="winput winput-area">
              <IconMessages size={17} />
              <textarea
                rows={6}
                value={d.instructions}
                onChange={(e) => set("instructions", e.target.value)}
                placeholder="Ex.: Convite para conhecer nosso plano de saúde empresarial, com economia em relação ao plano atual. Se pedirem valores, passe pra mim."
              />
            </span>
            <p className="hint">Escreva do seu jeito. A IA usa isso pra conversar com as pessoas desta campanha.</p>
          </label>
        )}

        {step === 3 && (
          <dl className="wreview">
            <div>
              <dt>Nome</dt>
              <dd>{d.name || "—"}</dd>
            </div>
            <div>
              <dt>Descrição</dt>
              <dd>{d.description || "—"}</dd>
            </div>
            <div>
              <dt>Público-alvo</dt>
              <dd>{d.audience.length ? d.audience.join(", ") : "—"}</dd>
            </div>
            <div>
              <dt>Limite de leads</dt>
              <dd>{d.maxLeads || "Sem limite"}</dd>
            </div>
            <div>
              <dt>Oferta</dt>
              <dd style={{ whiteSpace: "pre-line" }}>{d.instructions || "—"}</dd>
            </div>
          </dl>
        )}

        {state?.error && (
          <p className="error-text">
            <IconAlert size={15} /> {state.error}
          </p>
        )}
      </div>

      <div className="wizard-foot">
        {step === 0 ? (
          <Link href={cancelHref} className="btn btn-secondary">
            Cancelar
          </Link>
        ) : (
          <button type="button" className="btn btn-secondary" onClick={() => setStep(step - 1)}>
            <IconArrowLeft size={16} /> Voltar
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button key="next" type="button" className="btn btn-primary wizard-next" disabled={!canNext} onClick={() => setStep(step + 1)}>
            Salvar e continuar <IconArrowRight size={17} />
          </button>
        ) : (
          <button key="submit" type="submit" className="btn btn-primary wizard-next" disabled={pending || !d.name.trim()}>
            {pending ? "Salvando…" : submitLabel} {!pending && <IconCheck size={17} strokeWidth={2.6} />}
          </button>
        )}
      </div>
    </form>
  );
}
