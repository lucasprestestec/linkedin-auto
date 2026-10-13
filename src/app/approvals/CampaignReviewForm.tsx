"use client";

import { useState, useTransition } from "react";
import { Stepper } from "@/components/Stepper";
import { updateCampaignReview } from "./actions";

// Revisão de campanha nova: as mensagens de uma campanha recém-criada passam
// por você até completar os dias E as mensagens, mesmo com a aprovação desligada.
export function CampaignReviewForm({ on, days, messages }: { on: boolean; days: number; messages: number }) {
  const [form, setForm] = useState({ on, days, messages });
  const [saved, setSaved] = useState({ on, days, messages });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dirty = form.on !== saved.on || form.days !== saved.days || form.messages !== saved.messages;

  return (
    <div className="stack" style={{ gap: 4 }}>
      <div className="setting" style={{ padding: "8px 0" }}>
        <span className="setting-text">
          <b>Revisar campanha nova</b>
          <small>mesmo com a aprovação desligada, o que for de uma campanha nova passa por você</small>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={form.on}
          aria-label="Revisar campanha nova"
          className="switch"
          onClick={() => setForm((f) => ({ ...f, on: !f.on }))}
        />
      </div>
      {form.on && (
        <>
          <div className="setting" style={{ padding: "8px 0" }}>
            <label htmlFor="reviewDays" className="setting-text">
              <b>Por pelo menos</b>
              <small>dias desde que a campanha foi criada</small>
            </label>
            <Stepper id="reviewDays" name="reviewDays" value={form.days} min={1} max={90} onChange={(days) => setForm((f) => ({ ...f, days }))} />
          </div>
          <div className="setting" style={{ padding: "8px 0" }}>
            <label htmlFor="reviewMessages" className="setting-text">
              <b>E pelo menos</b>
              <small>mensagens enviadas na campanha</small>
            </label>
            <Stepper id="reviewMessages" name="reviewMessages" value={form.messages} min={1} max={500} step={5} onChange={(messages) => setForm((f) => ({ ...f, messages }))} />
          </div>
          <p className="hint" style={{ margin: 0 }}>
            A revisão termina quando os dois se cumprem: {form.days} dias e {form.messages} mensagens, o que acontecer depois. Dá para liberar antes na página da campanha.
          </p>
        </>
      )}
      {(dirty || error) && (
        <div className="form-actions">
          {dirty && (
            <button
              type="button"
              className="btn-solid btn-sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await updateCampaignReview(form);
                  setError(r.error ?? null);
                  if (!r.error) setSaved(form);
                })
              }
            >
              {pending ? "Salvando…" : "Salvar"}
            </button>
          )}
          {error && <span className="field-error">{error}</span>}
        </div>
      )}
    </div>
  );
}
