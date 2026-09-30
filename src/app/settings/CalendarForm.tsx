"use client";

import { useState, useTransition } from "react";
import { Help } from "@/components/Help";
import { updateMeetingMinutes } from "./actions";

const DURATIONS = [15, 20, 30, 45, 60];

// Agenda do Google: o assistente vê seus horários livres e marca a reunião sozinha.
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
    <div className="stack" style={{ gap: 14 }}>
      {calendarEnabled ? (
        <p className="note note-ok">
          <b>Agenda conectada</b> ({googleEmail}). O assistente oferece só horários livres e marca a reunião por você.{" "}
          <Help>
            A agenda usada é a da mesma conta Google do e-mail. As reuniões são criadas nela e só os compromissos dela bloqueiam horários. Se a sua agenda de
            verdade fica em outra conta, reconecte o Google com essa conta.
          </Help>
        </p>
      ) : (
        <div className="stack" style={{ gap: 8, alignItems: "flex-start" }}>
          <p>
            {googleEmail
              ? "O Google está conectado, mas sem a permissão da agenda. Reconecte e marque a permissão de agenda."
              : "Conecte o Google para o assistente ver seus horários livres e marcar as reuniões."}{" "}
            <Help>A agenda usada é a da mesma conta Google do e-mail. Entre com a conta em que você mantém a sua agenda.</Help>
          </p>
          {configured ? (
            <a href="/api/email/google/start" className="btn-solid btn-sm">
              {googleEmail ? "Reconectar o Google" : "Conectar o Google"}
            </a>
          ) : (
            <p className="hint">O login do Google ainda não foi ativado neste sistema. Fale com o suporte.</p>
          )}
        </div>
      )}

      <div>
        <label htmlFor="meeting-minutes" className="label">
          Duração da reunião{" "}
          <Help>
            Só oferece horários dentro do seu horário de trabalho ({workHours}), de hora cheia ou meia hora, com 4 horas de antecedência e folga entre
            compromissos. Vídeo pelo Google Meet.
          </Help>
        </label>
        <select
          id="meeting-minutes"
          className="field"
          style={{ maxWidth: 200 }}
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
      </div>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
