"use client";

import { useState, useTransition } from "react";
import { Help } from "@/components/Help";
import { updateMeetingMinutes } from "./actions";

const DURATIONS = [15, 20, 30, 45, 60];

// Regras das reuniões: o assistente vê seus horários livres no Google Agenda e marca a reunião sozinho.
// A conexão com o Google fica na linha "Conta Google" (acima): aqui só se escolhe a duração.
export function CalendarForm({
  minutes,
  googleEmail,
  calendarEnabled,
  workHours,
  notice,
}: {
  minutes: number;
  googleEmail: string | null;
  calendarEnabled: boolean;
  workHours: string;
  // "com 4 horas de antecedência" ou "a partir do próximo dia útil".
  notice: string;
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
            A agenda usada é a da Conta Google conectada na linha acima. As reuniões são criadas nela e só os compromissos dela bloqueiam horários. Se a sua agenda de
            verdade fica em outra conta, reconecte a Conta Google com essa conta.
          </Help>
        </p>
      ) : (
        <p className="note">
          A agenda usa a <b>Conta Google</b> (linha logo acima). {googleEmail ? "Ela está conectada, mas sem a permissão da agenda: reconecte e marque a permissão de agenda." : "Conecte-a para o assistente ver seus horários livres e marcar as reuniões."}
        </p>
      )}

      <div>
        <label htmlFor="meeting-minutes" className="label">
          Duração da reunião{" "}
          <Help>
            Só oferece horários dentro do seu horário de trabalho ({workHours}), de hora cheia ou meia hora, {notice} e folga entre
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
