"use client";

import { useState, useTransition } from "react";
import { FollowUpFields, type FollowUpValue } from "@/components/FollowUpFields";
import { IconCheck } from "@/components/Icons";
import { updateFollowUpDefault } from "./actions";

// Padrão da conta. Campanhas e conversas podem ter a própria regra.
export function FollowUpDefaultForm({ count, days }: FollowUpValue) {
  const [value, setValue] = useState<FollowUpValue>({ count, days });
  const [saved, setSaved] = useState<FollowUpValue>({ count, days });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const dirty = value.count !== saved.count || value.days !== saved.days;

  return (
    <div className="card card-pad stack" style={{ gap: 14 }}>
      <FollowUpFields value={value} onChange={setValue} idPrefix="fu-default" />
      <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
        <span className="tiny faint">Campanhas e conversas podem ter uma regra própria.</span>
        {dirty ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await updateFollowUpDefault(value.count, value.days);
                if (r.error) setError(r.error);
                else {
                  setError(null);
                  setSaved(value);
                }
              })
            }
          >
            {pending ? "Salvando…" : "Salvar"}
          </button>
        ) : (
          <span className="success-text" style={{ visibility: saved === value ? "visible" : "hidden" }}>
            <IconCheck size={15} strokeWidth={3} /> Salvo
          </span>
        )}
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
