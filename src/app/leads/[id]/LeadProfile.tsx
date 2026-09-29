"use client";

import { useState, useTransition } from "react";
import { IconAlert, IconMail, IconPlus, IconSparkles, IconUser } from "@/components/Icons";
import { updateLeadProfile } from "./actions";

function formatPhone(phone: string | null) {
  if (!phone) return "";
  const d = phone.replace(/^55/, "");
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : phone;
}

// Ficha pessoal: e-mail, WhatsApp e o que você sabe da pessoa. Diferente das
// anotações (só você vê), a secretária LÊ a ficha e usa nas mensagens.
export function LeadProfile({
  leadId,
  firstName,
  email,
  phone,
  personal,
  variant = "side",
}: {
  leadId: string;
  firstName: string;
  email: string | null;
  phone: string | null;
  personal: string | null;
  variant?: "side" | "tab";
}) {
  const [saved, setSaved] = useState({ email: email ?? "", phone: formatPhone(phone), personal: personal ?? "" });
  const [form, setForm] = useState(saved);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const empty = !saved.email && !saved.phone && !saved.personal;

  function save() {
    setError(null);
    start(async () => {
      const r = await updateLeadProfile(leadId, form);
      if (r.error) return setError(r.error);
      const next = { ...form, email: form.email.trim().toLowerCase(), personal: form.personal.trim() };
      setSaved(next);
      setForm(next);
      setEditing(false);
    });
  }

  return (
    <section className={variant === "side" ? "side-card profile-card" : "stack profile-card"} style={variant === "tab" ? { gap: 12 } : undefined}>
      <div className="side-card-head">
        <h3>
          <IconUser size={19} /> Ficha pessoal
        </h3>
        {!editing && (
          <button type="button" className="link-btn brand" onClick={() => setEditing(true)}>
            <IconPlus size={15} /> {empty ? "Preencher" : "Editar"}
          </button>
        )}
      </div>

      {editing ? (
        <div className="stack" style={{ gap: 10 }}>
          <label className="field" style={{ gap: 4 }}>
            <span className="label">E-mail</span>
            <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="nome@empresa.com.br" />
          </label>
          <label className="field" style={{ gap: 4 }}>
            <span className="label">WhatsApp</span>
            <input className="input" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(51) 99999-0000" />
          </label>
          <label className="field" style={{ gap: 4 }}>
            <span className="label">O que você sabe {firstName ? `sobre ${firstName}` : "dessa pessoa"}</span>
            <textarea
              className="textarea"
              rows={4}
              value={form.personal}
              onChange={(e) => setForm({ ...form, personal: e.target.value })}
              placeholder="Ex.: tem 2 filhos, torce pro Grêmio, aniversário 12/03, nos conhecemos no evento da ACIPA."
              style={{ fontSize: 14.5, resize: "vertical" }}
            />
            <span className="tiny faint">A secretária usa isso pra deixar as mensagens pessoais, com naturalidade.</span>
          </label>
          {error && (
            <p className="error-text">
              <IconAlert size={15} /> {error}
            </p>
          )}
          <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setForm(saved);
                setEditing(false);
                setError(null);
              }}
            >
              Cancelar
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={pending}>
              {pending ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>
      ) : empty ? (
        <p className="small faint">Sem e-mail, WhatsApp ou detalhes pessoais ainda. Com eles, a secretária fala por mais canais e de um jeito mais pessoal.</p>
      ) : (
        <div className="stack profile-view" style={{ gap: 8 }}>
          {saved.email && (
            <span className="profile-line">
              <IconMail size={15} /> {saved.email}
            </span>
          )}
          {saved.phone && (
            <span className="profile-line">
              <span className="profile-wa">WA</span> {saved.phone}
            </span>
          )}
          {saved.personal && (
            <p className="profile-personal">
              <IconSparkles size={14} /> {saved.personal}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
