"use client";

import { useState, useTransition } from "react";
import { Help } from "@/components/Help";
import { updateLeadProfile } from "./actions";

function formatPhone(phone: string | null) {
  if (!phone) return "";
  const d = phone.replace(/^55/, "");
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : phone;
}

// Contato e o que você sabe da pessoa. Diferente das anotações, a secretária LÊ
// isto e usa nas mensagens.
export function LeadProfile({
  leadId,
  firstName,
  email,
  phone,
  personal,
}: {
  leadId: string;
  firstName: string;
  email: string | null;
  phone: string | null;
  personal: string | null;
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
    <section className="sec">
      <div className="sec-head">
        <h2 className="t-label">
          Contato
          <Help>Com e-mail ou WhatsApp, a secretária também fala por esses canais. O que você escrever em &ldquo;o que você sabe&rdquo; ela usa para deixar as mensagens mais pessoais.</Help>
        </h2>
        {!editing && (
          <button type="button" className="btn-text" onClick={() => setEditing(true)}>
            {empty ? "Preencher" : "Editar"}
          </button>
        )}
      </div>

      {editing ? (
        <div className="form" style={{ gap: 12 }}>
          <div>
            <label className="label">E-mail</label>
            <input className="field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="nome@empresa.com.br" />
          </div>
          <div>
            <label className="label">WhatsApp</label>
            <input className="field" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(51) 99999-0000" />
          </div>
          <div>
            <label className="label">O que você sabe {firstName ? `sobre ${firstName}` : "dessa pessoa"}</label>
            <textarea
              className="field"
              rows={4}
              value={form.personal}
              onChange={(e) => setForm({ ...form, personal: e.target.value })}
              placeholder="Ex.: tem 2 filhos, torce pro Grêmio, nos conhecemos no evento da ACIPA."
            />
          </div>
          {error && <p className="field-error">{error}</p>}
          <div className="form-actions">
            <button type="button" className="btn-solid btn-sm" onClick={save} disabled={pending}>
              {pending ? "Salvando…" : "Salvar"}
            </button>
            <button
              type="button"
              className="btn-text"
              onClick={() => {
                setForm(saved);
                setEditing(false);
                setError(null);
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : empty ? (
        <p className="empty">Sem e-mail, WhatsApp ou detalhes ainda.</p>
      ) : (
        <div className="stack" style={{ gap: 6 }}>
          {saved.email && <span>{saved.email}</span>}
          {saved.phone && <span>{saved.phone}</span>}
          {saved.personal && <p className="muted">{saved.personal}</p>}
        </div>
      )}
    </section>
  );
}
