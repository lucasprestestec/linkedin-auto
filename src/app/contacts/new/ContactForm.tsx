"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { Help } from "@/components/Help";
import { createContact, type ContactFormState } from "./actions";

type FirstContact = "ME" | "LINKEDIN" | "EMAIL" | "WHATSAPP";

export function ContactForm({
  campaigns,
  ready,
}: {
  campaigns: { id: string; name: string }[];
  ready: { LINKEDIN: boolean; EMAIL: boolean; WHATSAPP: boolean };
}) {
  const [state, action, pending] = useActionState<ContactFormState, FormData>(createContact, undefined);
  const [values, setValues] = useState({ phone: "", email: "", linkedin: "" });
  const [first, setFirst] = useState<FirstContact>("ME");

  // Cada opção de primeiro contato só aparece habilitada com o dado e o canal prontos.
  const options: { id: FirstContact; label: string; hint: string; enabled: boolean; why?: string }[] = [
    { id: "ME", label: "Eu mesmo começo", hint: "Nada é enviado agora. Quando você mandar a primeira mensagem, a secretária acompanha.", enabled: true },
    {
      id: "WHATSAPP",
      label: "A secretária manda um WhatsApp",
      hint: "Primeira mensagem curta, no próximo horário de trabalho, usando o que você escrever sobre a pessoa.",
      enabled: ready.WHATSAPP && Boolean(values.phone.trim()),
      why: !ready.WHATSAPP ? "Conecte o WhatsApp em Canais" : "Informe o WhatsApp",
    },
    {
      id: "EMAIL",
      label: "A secretária se apresenta por e-mail",
      hint: "E-mail de apresentação no próximo horário de trabalho, com rastreio de abertura.",
      enabled: ready.EMAIL && Boolean(values.email.trim()),
      why: !ready.EMAIL ? "Conecte o e-mail em Canais" : "Informe o e-mail",
    },
    {
      id: "LINKEDIN",
      label: "Convidar no LinkedIn",
      hint: "Convite de conexão; quando aceitar, a secretária abre a conversa por lá.",
      enabled: ready.LINKEDIN && Boolean(values.linkedin.trim()),
      why: !ready.LINKEDIN ? "Conecte o LinkedIn em Canais" : "Informe o link do perfil",
    },
  ];
  const chosen = options.find((o) => o.id === first);
  const effective: FirstContact = chosen?.enabled ? first : "ME";

  return (
    <form
      className="stack"
      style={{ gap: 16 }}
      // Envio manual (não `action=`): com action, o React limpa o formulário ao
      // terminar, e um erro de validação apagaria tudo que foi digitado.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
    >
      <section className="sec">
        <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
          <div className="grow">
            <label className="label">Nome *</label>
            <input className="field" name="firstName" required autoComplete="off" placeholder="Mariana" />
          </div>
          <div className="grow">
            <label className="label">Sobrenome</label>
            <input className="field" name="lastName" autoComplete="off" placeholder="Costa" />
          </div>
        </div>
        <div>
          <label className="label">Cargo e empresa</label>
          <input className="field" name="jobTitle" autoComplete="off" placeholder="Diretora de RH · Grupo Vértice" />
        </div>
        <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
          <div className="grow">
            <label className="label">WhatsApp</label>
            <input
              className="field"
              name="phone"
              inputMode="tel"
              placeholder="(51) 99999-0000"
              value={values.phone}
              onChange={(e) => setValues({ ...values, phone: e.target.value })}
            />
          </div>
          <div className="grow">
            <label className="label">E-mail</label>
            <input
              className="field"
              name="email"
              type="email"
              placeholder="nome@empresa.com.br"
              value={values.email}
              onChange={(e) => setValues({ ...values, email: e.target.value })}
            />
          </div>
        </div>
        <div>
          <label className="label">LinkedIn (opcional)</label>
          <input
            className="field"
            name="linkedin"
            inputMode="url"
            placeholder="https://www.linkedin.com/in/…"
            value={values.linkedin}
            onChange={(e) => setValues({ ...values, linkedin: e.target.value })}
          />
        </div>
        <div>
          <label className="label">
            O que você sabe dessa pessoa <Help>A secretária usa isso para fazer a ponte na primeira mensagem e deixar a conversa pessoal.</Help>
          </label>
          <textarea
            className="field"
            name="personal"
            rows={3}
            placeholder="Ex.: indicação do João da Construtora X; nos conhecemos no evento da ACIPA; tem 2 filhos."
          />
        </div>
        {campaigns.length > 0 && (
          <div>
            <label className="label">Campanha (opcional)</label>
            <select className="field" name="campaignId" defaultValue="">
              <option value="">Sem campanha</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </section>

      <section className="sec">
        <h2 className="t-label">Primeiro contato</h2>
        <input type="hidden" name="firstContact" value={effective} />
        <div className="stack" style={{ gap: 8 }} role="radiogroup" aria-label="Primeiro contato">
          {options.map((o) => (
            <button key={o.id} type="button" role="radio" aria-checked={effective === o.id} disabled={!o.enabled} className="choice-row" onClick={() => setFirst(o.id)}>
              <span className="setting-text">
                <b>{o.label}</b>
                <small>{o.enabled ? o.hint : o.why}</small>
              </span>
              <span className="radio-dot" aria-hidden />
            </button>
          ))}
        </div>
      </section>

      {state?.error && (
        <p className="field-error">
          {state.error}{" "}
          {state.existingLeadId && (
            <Link href={`/leads/${state.existingLeadId}`} className="btn-text">
              Abrir a conversa dela
            </Link>
          )}
        </p>
      )}

      <div className="row" style={{ gap: 10, justifyContent: "flex-end" }}>
        <Link href="/conversations" className="btn-line">
          Cancelar
        </Link>
        <button type="submit" className="btn-solid" disabled={pending}>
          {pending ? "Salvando…" : "Adicionar contato"}
        </button>
      </div>
    </form>
  );
}
