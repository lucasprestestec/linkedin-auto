"use client";

import { useState, useTransition } from "react";
import { IconCheck } from "@/components/Icons";
import { updateBookingUrl } from "./actions";

// Link da agenda online do corretor (Calendly, Cal.com, Google...). A secretária
// o manda quando o lead topa conversar; sem ele, ela passa o lead pro corretor.
export function BookingForm({ value }: { value: string }) {
  const [url, setUrl] = useState(value);
  const [saved, setSaved] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = url.trim() !== saved.trim();

  return (
    <div className="card card-pad stack" style={{ gap: 12 }}>
      <label htmlFor="booking-url" className="label">
        Link da sua agenda
      </label>
      <div className="row" style={{ gap: 8 }}>
        <input
          id="booking-url"
          className="input"
          style={{ height: 46, fontSize: 16 }}
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://calendly.com/seu-nome/15min"
          maxLength={300}
        />
        {dirty ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ height: 46 }}
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await updateBookingUrl(url);
                if (r.error) setError(r.error);
                else {
                  setError(null);
                  setUrl(r.url ?? "");
                  setSaved(r.url ?? "");
                }
              })
            }
          >
            {pending ? "Salvando…" : "Salvar"}
          </button>
        ) : (
          saved && (
            <span className="success-text" style={{ flexShrink: 0 }}>
              <IconCheck size={15} strokeWidth={3} /> Salvo
            </span>
          )
        )}
      </div>
      <span className="tiny faint">
        A secretária manda este link quando o lead topar conversar, para ele escolher o horário. Sem o link, ela passa a conversa pra você.
      </span>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
