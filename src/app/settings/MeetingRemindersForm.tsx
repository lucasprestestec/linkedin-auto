"use client";

import { useState, useTransition } from "react";
import { updateMeetingReminders } from "./teamActions";

interface Texts {
  day: string;
  h5: string;
  h1: string;
  noShow: string;
}

// Lembretes da reunião pro lead: véspera, 5h e 1h antes, e o "senti sua falta".
// Campos: [NOME], [HORA], [DIA], [ESPECIALISTA] (seu nome) e [LINK] (videochamada).
export function MeetingRemindersForm({ enabled, texts, defaults }: { enabled: boolean; texts: Texts; defaults: Texts }) {
  const [form, setForm] = useState({ enabled, ...texts });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const fields: { key: keyof Texts; label: string }[] = [
    { key: "day", label: "Na véspera" },
    { key: "h5", label: "5 horas antes" },
    { key: "h1", label: "1 hora antes" },
    { key: "noShow", label: "Se a pessoa faltar (você marca na conversa)" },
  ];

  return (
    <div className="form" style={{ gap: 12 }}>
      <div className="setting" style={{ padding: 0 }}>
        <span className="setting-text">
          <b>Mandar lembretes</b>
          <small>no canal da conversa, dentro do seu horário de trabalho</small>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={form.enabled}
          aria-label="Mandar lembretes da reunião"
          className="switch"
          onClick={() => {
            setSaved(false);
            setForm((f) => ({ ...f, enabled: !f.enabled }));
          }}
        />
      </div>
      {fields.map((f) => (
        <label key={f.key}>
          <span className="label">{f.label}</span>
          <textarea
            className="field"
            rows={2}
            value={form[f.key]}
            placeholder={defaults[f.key]}
            onChange={(e) => {
              setSaved(false);
              setForm((s) => ({ ...s, [f.key]: e.target.value }));
            }}
          />
        </label>
      ))}
      <p className="hint" style={{ margin: 0 }}>
        Vazio usa o texto padrão (em cinza). Campos: [NOME], [HORA], [DIA], [ESPECIALISTA] (seu nome) e [LINK] (o link da videochamada; sem link, a frase
        sai inteira).
      </p>
      <div className="form-actions">
        <button
          type="button"
          className="btn-solid btn-sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await updateMeetingReminders({ enabled: form.enabled, day: form.day, h5: form.h5, h1: form.h1, noShow: form.noShow });
              setError(r.error ?? null);
              setSaved(!r.error);
            })
          }
        >
          {pending ? "Salvando…" : "Salvar"}
        </button>
        {saved && <span className="ok-text">Salvo</span>}
        {error && <span className="field-error">{error}</span>}
      </div>
    </div>
  );
}
