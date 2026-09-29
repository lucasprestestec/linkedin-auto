"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { IconAlert, IconChat, IconLinkedin, IconMail, IconUser } from "@/components/Icons";
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
  const options: { id: FirstContact; label: string; hint: string; icon: React.ReactNode; enabled: boolean; why?: string }[] = [
    { id: "ME", label: "Eu mesmo começo", hint: "Nada é enviado agora. Quando você mandar a primeira mensagem, a secretária acompanha.", icon: <IconUser size={16} />, enabled: true },
    {
      id: "WHATSAPP",
      label: "A secretária manda um WhatsApp",
      hint: "Primeira mensagem curta, no próximo horário de trabalho, usando o que você escrever sobre a pessoa.",
      icon: <IconChat size={16} />,
      enabled: ready.WHATSAPP && Boolean(values.phone.trim()),
      why: !ready.WHATSAPP ? "Conecte o WhatsApp em Canais" : "Informe o WhatsApp",
    },
    {
      id: "EMAIL",
      label: "A secretária se apresenta por e-mail",
      hint: "E-mail de apresentação no próximo horário de trabalho, com rastreio de abertura.",
      icon: <IconMail size={16} />,
      enabled: ready.EMAIL && Boolean(values.email.trim()),
      why: !ready.EMAIL ? "Conecte o e-mail em Canais" : "Informe o e-mail",
    },
    {
      id: "LINKEDIN",
      label: "Convidar no LinkedIn",
      hint: "Convite de conexão; quando aceitar, a secretária abre a conversa por lá.",
      icon: <IconLinkedin size={16} />,
      enabled: ready.LINKEDIN && Boolean(values.linkedin.trim()),
      why: !ready.LINKEDIN ? "Conecte o LinkedIn em Canais" : "Informe o link do perfil",
    },
  ];
  const chosen = options.find((o) => o.id === first);
  const effective: FirstContact = chosen?.enabled ? first : "ME";

  return (
    <form
      className="stack contact-form"
      style={{ gap: 18 }}
      // Envio manual (não `action=`): com action, o React limpa o formulário ao
      // terminar — e um erro de validação apagaria tudo que foi digitado.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
    >
      <section className="card card-pad stack" style={{ gap: 12 }}>
        <div className="row two-cols" style={{ gap: 10 }}>
          <label className="field" style={{ gap: 4, flex: 1 }}>
            <span className="label">Nome *</span>
            <input className="input" name="firstName" required autoComplete="off" placeholder="Mariana" />
          </label>
          <label className="field" style={{ gap: 4, flex: 1 }}>
            <span className="label">Sobrenome</span>
            <input className="input" name="lastName" autoComplete="off" placeholder="Costa" />
          </label>
        </div>
        <label className="field" style={{ gap: 4 }}>
          <span className="label">Cargo e empresa</span>
          <input className="input" name="jobTitle" autoComplete="off" placeholder="Diretora de RH · Grupo Vértice" />
        </label>
        <div className="row two-cols" style={{ gap: 10 }}>
          <label className="field" style={{ gap: 4, flex: 1 }}>
            <span className="label">WhatsApp</span>
            <input
              className="input"
              name="phone"
              inputMode="tel"
              placeholder="(51) 99999-0000"
              value={values.phone}
              onChange={(e) => setValues({ ...values, phone: e.target.value })}
            />
          </label>
          <label className="field" style={{ gap: 4, flex: 1 }}>
            <span className="label">E-mail</span>
            <input
              className="input"
              name="email"
              type="email"
              placeholder="nome@empresa.com.br"
              value={values.email}
              onChange={(e) => setValues({ ...values, email: e.target.value })}
            />
          </label>
        </div>
        <label className="field" style={{ gap: 4 }}>
          <span className="label">LinkedIn (opcional)</span>
          <input
            className="input"
            name="linkedin"
            inputMode="url"
            placeholder="https://www.linkedin.com/in/…"
            value={values.linkedin}
            onChange={(e) => setValues({ ...values, linkedin: e.target.value })}
          />
        </label>
        <label className="field" style={{ gap: 4 }}>
          <span className="label">O que você sabe dessa pessoa</span>
          <textarea
            className="textarea"
            name="personal"
            rows={3}
            placeholder="Ex.: indicação do João da Construtora X; nos conhecemos no evento da ACIPA; tem 2 filhos."
            style={{ resize: "vertical" }}
          />
          <span className="tiny faint">A secretária usa isso pra fazer a ponte na primeira mensagem e deixar a conversa pessoal.</span>
        </label>
        {campaigns.length > 0 && (
          <label className="field" style={{ gap: 4 }}>
            <span className="label">Campanha (opcional)</span>
            <select className="input" name="campaignId" defaultValue="">
              <option value="">Sem campanha</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>

      <section className="stack" style={{ gap: 8 }}>
        <h2 className="group-title">Primeiro contato</h2>
        <input type="hidden" name="firstContact" value={effective} />
        <div className="first-contact" role="radiogroup" aria-label="Primeiro contato">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={effective === o.id}
              disabled={!o.enabled}
              className={effective === o.id ? "fc-option active" : "fc-option"}
              onClick={() => setFirst(o.id)}
            >
              <span className="fc-icon">{o.icon}</span>
              <span className="fc-text">
                <b>{o.label}</b>
                <small>{o.enabled ? o.hint : o.why}</small>
              </span>
            </button>
          ))}
        </div>
      </section>

      {state?.error && (
        <p className="error-text">
          <IconAlert size={15} /> {state.error}{" "}
          {state.existingLeadId && (
            <Link href={`/leads/${state.existingLeadId}`} className="link-btn brand">
              Abrir a conversa dela
            </Link>
          )}
        </p>
      )}

      <div className="row" style={{ gap: 10, justifyContent: "flex-end" }}>
        <Link href="/conversations" className="btn btn-secondary">
          Cancelar
        </Link>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Salvando…" : "Adicionar contato"}
        </button>
      </div>
    </form>
  );
}
