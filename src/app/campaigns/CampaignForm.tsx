"use client";

import { useActionState, useState } from "react";
import { IconAlert, IconArrowRight, IconCheck } from "@/components/Icons";
import type { CampaignFormState } from "./actions";

const NAME_EXAMPLES = ["Saúde empresarial", "Seguro de vida", "Previdência para sócios", "Seguro empresarial"];

// Criar ou editar campanha: só duas perguntas, em linguagem de gente.
export function CampaignForm({
  action,
  initial,
  submitLabel,
  onCancel,
}: {
  action: (prev: CampaignFormState, formData: FormData) => Promise<CampaignFormState>;
  initial?: { name: string; instructions: string };
  submitLabel: string;
  onCancel?: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [name, setName] = useState(initial?.name ?? "");
  const [offer, setOffer] = useState(initial?.instructions ?? "");
  const saved = state && !state.error && initial;

  return (
    <form action={formAction} className="stack campaign-form" style={{ gap: 22 }}>
      <div className="q-block">
        <label htmlFor="camp-name" className="q-label">
          <span className="q-num">1</span> Como você quer chamar esta campanha?
        </label>
        <input
          id="camp-name"
          name="name"
          className="input q-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Saúde empresarial"
          maxLength={60}
          required
          autoFocus={!initial}
        />
        {!initial && (
          <div className="tag-suggestions">
            {NAME_EXAMPLES.map((n) => (
              <button key={n} type="button" onClick={() => setName(n)}>
                {n}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="q-block">
        <label htmlFor="camp-offer" className="q-label">
          <span className="q-num">2</span> O que você quer oferecer pra essas pessoas?
        </label>
        <textarea
          id="camp-offer"
          name="instructions"
          className="textarea q-input"
          rows={5}
          value={offer}
          onChange={(e) => setOffer(e.target.value)}
          placeholder="Ex.: Plano de saúde para empresas de 10 a 200 funcionários. Destaque que dá pra reduzir o custo em relação ao plano atual. Se pedirem valores, passe pra mim."
        />
        <p className="hint">Escreva do seu jeito. A IA usa isso pra conversar com as pessoas desta campanha.</p>
      </div>

      {state?.error && (
        <p className="error-text">
          <IconAlert size={15} /> {state.error}
        </p>
      )}

      <div className="row" style={{ gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
        {saved && (
          <span className="success-text" style={{ marginRight: "auto" }}>
            <IconCheck size={15} strokeWidth={3} /> Salvo
          </span>
        )}
        {onCancel && (
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button type="submit" className="btn btn-primary btn-lg" disabled={pending || !name.trim()}>
          {pending ? "Salvando…" : submitLabel} {!pending && !initial && <IconArrowRight size={18} />}
        </button>
      </div>
    </form>
  );
}
