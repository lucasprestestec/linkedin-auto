"use client";

import { useState, useTransition } from "react";
import type { LeadKind } from "@prisma/client";
import { LEAD_KIND_LABEL } from "@/lib/leadKind";
import { removeTeamMember, saveTeamMember, testTeamMember, type MemberInput } from "./teamActions";

export interface Member extends MemberInput {
  id: string;
}

const EMPTY: MemberInput = { name: "", email: "", phone: "", notifyUrgent: true, notifyMeetings: false, notifyHandoffs: false, role: "", handles: [], viaEmail: true, viaWhatsapp: true };

const KINDS = Object.keys(LEAD_KIND_LABEL) as LeadKind[];

const FLAGS: { key: "notifyUrgent" | "notifyMeetings" | "notifyHandoffs"; label: string; hint: string }[] = [
  { key: "notifyUrgent", label: "Urgências", hint: "sinistro, reclamação, jurídico, cancelamento" },
  { key: "notifyMeetings", label: "Reuniões e ligações", hint: "reunião marcada e hora de ligar" },
  { key: "notifyHandoffs", label: "Todo “precisa de você”", hint: "qualquer conversa que passar pra uma pessoa" },
];

function summary(m: MemberInput) {
  const what = FLAGS.filter((f) => m[f.key]).map((f) => f.label.toLowerCase());
  const via = [m.email && m.viaEmail && "e-mail", m.phone && m.viaWhatsapp && "WhatsApp"].filter(Boolean).join(" e ");
  const cares = m.handles.length ? ` · cuida de ${m.handles.map((k) => LEAD_KIND_LABEL[k as LeadKind].toLowerCase()).join(", ")}` : "";
  return `${m.role ? `${m.role} · ` : ""}${what.length ? what.join(", ") : "nenhum aviso"} · por ${via || "—"}${cares}`;
}

// Equipe que recebe avisos por e-mail e/ou WhatsApp (os canais conectados em Canais).
export function TeamForm({ members }: { members: Member[] }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<MemberInput>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  function open(m: Member | null) {
    setError(null);
    setEditing(m ? m.id : "new");
    setForm(m ? { name: m.name, email: m.email, phone: m.phone, notifyUrgent: m.notifyUrgent, notifyMeetings: m.notifyMeetings, notifyHandoffs: m.notifyHandoffs, role: m.role, handles: m.handles, viaEmail: m.viaEmail, viaWhatsapp: m.viaWhatsapp } : EMPTY);
  }

  const editor = (
    <div className="form" style={{ gap: 10 }}>
      <label>
        <span className="label">Nome</span>
        <input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Maria Eduarda" />
      </label>
      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <label className="grow" style={{ minWidth: 180 }}>
          <span className="label">E-mail</span>
          <input className="field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label className="grow" style={{ minWidth: 180 }}>
          <span className="label">WhatsApp</span>
          <input className="field" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-0000" />
        </label>
      </div>
      <label>
        <span className="label">Função</span>
        <input className="field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Ex.: Especialista, Preposto, Recrutamento" />
      </label>
      <div>
        <span className="label">Cuida de</span>
        <div className="row" style={{ gap: 14, flexWrap: "wrap" }}>
          {KINDS.map((k) => (
            <label key={k} className="row" style={{ gap: 6, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={form.handles.includes(k)}
                onChange={(e) => setForm({ ...form, handles: e.target.checked ? [...form.handles, k] : form.handles.filter((x) => x !== k) })}
              />
              {LEAD_KIND_LABEL[k]}
            </label>
          ))}
        </div>
        <small className="hint">Recebe a reunião marcada e o “precisa de você” dos contatos desse tipo que não têm responsável.</small>
      </div>
      <div className="setting" style={{ padding: 0 }}>
        <span className="setting-text">
          <b>Avisar por e-mail</b>
          <small>precisa do e-mail preenchido</small>
        </span>
        <button type="button" role="switch" aria-checked={form.viaEmail} aria-label="Avisar por e-mail" className="switch" onClick={() => setForm({ ...form, viaEmail: !form.viaEmail })} />
      </div>
      <div className="setting" style={{ padding: 0 }}>
        <span className="setting-text">
          <b>Avisar por WhatsApp</b>
          <small>precisa do WhatsApp preenchido</small>
        </span>
        <button type="button" role="switch" aria-checked={form.viaWhatsapp} aria-label="Avisar por WhatsApp" className="switch" onClick={() => setForm({ ...form, viaWhatsapp: !form.viaWhatsapp })} />
      </div>
      {FLAGS.map((f) => (
        <div key={f.key} className="setting" style={{ padding: 0 }}>
          <span className="setting-text">
            <b>{f.label}</b>
            <small>{f.hint}</small>
          </span>
          <button type="button" role="switch" aria-checked={form[f.key]} aria-label={f.label} className="switch" onClick={() => setForm({ ...form, [f.key]: !form[f.key] })} />
        </div>
      ))}
      <div className="form-actions">
        <button
          type="button"
          className="btn-solid btn-sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await saveTeamMember(editing === "new" ? null : editing, form);
              if (r.error) return setError(r.error);
              setEditing(null);
            })
          }
        >
          {pending ? "Salvando…" : "Salvar"}
        </button>
        <button type="button" className="btn-text" onClick={() => setEditing(null)}>
          Cancelar
        </button>
        {error && <span className="field-error">{error}</span>}
      </div>
    </div>
  );

  return (
    <div className="stack" style={{ gap: 12 }}>
      <p className="hint" style={{ margin: 0 }}>
        Além do aviso no seu celular, essas pessoas recebem por e-mail e/ou WhatsApp (pelos canais conectados em Canais). Os avisos de WhatsApp aparecem como
        conversas no Deskcomm.
      </p>
      {members.length > 0 && (
        <ul className="list">
          {members.map((m) => (
            <li key={m.id}>
              {editing === m.id ? (
                editor
              ) : (
                <div className="item">
                  <div className="item-main">
                    <span className="item-title">{m.name}</span>
                    <span className="item-sub">{testResult[m.id] ?? summary(m)}</span>
                  </div>
                  <button
                    type="button"
                    className="btn-text"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await testTeamMember(m.id);
                        setTestResult((t) => ({ ...t, [m.id]: r.error ?? `Teste enviado por ${r.channels!.join(" e ")}.` }));
                      })
                    }
                  >
                    Testar
                  </button>
                  <button type="button" className="btn-text" onClick={() => open(m)}>
                    Editar
                  </button>
                  <button
                    type="button"
                    className="btn-text"
                    onClick={() => {
                      if (window.confirm(`Tirar ${m.name} da equipe?`)) start(() => removeTeamMember(m.id));
                    }}
                  >
                    Tirar
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {editing === "new" ? (
        editor
      ) : (
        <div>
          <button type="button" className="btn-line btn-sm" onClick={() => open(null)}>
            Adicionar pessoa
          </button>
        </div>
      )}
    </div>
  );
}
