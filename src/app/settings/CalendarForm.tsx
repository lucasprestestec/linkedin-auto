"use client";

import { useState, useTransition } from "react";
import { IconAlert, IconCheck } from "@/components/Icons";
import { updateMeetingMinutes } from "./actions";

const DURATIONS = [15, 20, 30, 45, 60];

// Agenda do Google: a secretária vê seus horários livres e marca a reunião sozinha.
// Usa o mesmo login do Google do e-mail; se ele foi feito antes de existir a agenda,
// precisa reconectar uma vez pra liberar a permissão.
export function CalendarForm({
  minutes,
  googleEmail,
  calendarEnabled,
  configured,
  workHours,
}: {
  minutes: number;
  googleEmail: string | null;
  calendarEnabled: boolean;
  configured: boolean;
  workHours: string;
}) {
  const [value, setValue] = useState(minutes);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="card card-pad stack" style={{ gap: 14 }}>
      {calendarEnabled ? (
        <p className="success-text" style={{ margin: 0 }}>
          <IconCheck size={15} strokeWidth={3} /> Agenda conectada ({googleEmail}). A secretária oferece só horários livres e marca a reunião por você.
        </p>
      ) : (
        <div className="stack" style={{ gap: 8 }}>
          <p className="small" style={{ margin: 0 }}>
            <IconAlert size={14} />{" "}
            {googleEmail
              ? "O Google está conectado, mas sem a permissão da agenda. Reconecte e marque a permissão de agenda."
              : "Conecte o seu Google para a secretária ver seus horários livres e marcar as reuniões."}
          </p>
          {configured ? (
            <a href="/api/email/google/start" className="btn btn-primary btn-sm" style={{ alignSelf: "flex-start" }}>
              {googleEmail ? "Reconectar o Google" : "Conectar o Google"}
            </a>
          ) : (
            <p className="tiny faint" style={{ margin: 0 }}>
              O login do Google ainda não foi configurado neste sistema (GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET).
            </p>
          )}
        </div>
      )}

      <div className="stack" style={{ gap: 6 }}>
        <label htmlFor="meeting-minutes" className="label">
          Duração da reunião
        </label>
        <select
          id="meeting-minutes"
          className="input"
          style={{ height: 46, fontSize: 16, maxWidth: 200 }}
          value={value}
          disabled={pending}
          onChange={(e) => {
            const next = Number(e.target.value);
            setValue(next);
            startTransition(async () => {
              const r = await updateMeetingMinutes(next);
              setError(r.error ?? null);
            });
          }}
        >
          {DURATIONS.map((d) => (
            <option key={d} value={d}>
              {d} minutos
            </option>
          ))}
        </select>
        <span className="tiny faint">
          Só oferece horários dentro do seu horário de trabalho ({workHours}), de hora cheia ou meia hora, com 4 horas de antecedência e folga entre compromissos. Vídeo pelo Google Meet.
        </span>
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
