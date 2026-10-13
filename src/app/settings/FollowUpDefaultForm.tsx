"use client";

import { useState, useTransition } from "react";
import { FollowUpFields, type FollowUpValue } from "@/components/FollowUpFields";
import { updateFollowUpDefault } from "./actions";

// Padrão da conta. Campanhas e conversas podem ter a própria regra.
export function FollowUpDefaultForm({ count, days }: FollowUpValue) {
  const [value, setValue] = useState<FollowUpValue>({ count, days });
  const [saved, setSaved] = useState<FollowUpValue>({ count, days });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const dirty = value.count !== saved.count || value.days !== saved.days;

  return (
    <div className="stack" style={{ gap: 12 }}>
      <FollowUpFields value={value} onChange={setValue} idPrefix="fu-default" />
      <div className="form-actions">
        {dirty ? (
          <button
            type="button"
            className="btn-solid btn-sm"
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
          <span className="hint" style={{ margin: 0 }}>
            Campanhas e conversas podem ter uma regra própria.
          </span>
        )}
      </div>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
