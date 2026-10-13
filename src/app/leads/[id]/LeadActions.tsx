"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { LeadStatus } from "@prisma/client";
import { leadAction, markMeeting, type LeadActionKind } from "./actions";

// Botão principal (marcar como oportunidade) e "Mais". Marcar tira a pessoa da
// automação de abordagem; assumir faz o assistente parar de responder até você devolver.
export function LeadActions({ leadId, status, profileUrl }: { leadId: string; status: LeadStatus; profileUrl: string | null }) {
  const [open, setOpen] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [when, setWhen] = useState("");
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function run(kind: LeadActionKind) {
    setOpen(false);
    startTransition(async () => {
      await leadAction(leadId, kind);
    });
  }

  const meeting = status === "MEETING_SCHEDULED";
  const qualified = status === "QUALIFIED" || meeting;

  function confirmMeeting() {
    setOpen(false);
    setMeetingOpen(false);
    startTransition(async () => {
      await markMeeting(leadId, when || null);
      setWhen("");
    });
  }

  return (
    <div className="row wrap" ref={ref} style={{ gap: 8 }}>
      <button type="button" className="btn-solid btn-sm" disabled={pending || qualified} onClick={() => run("qualify")}>
        {meeting ? "Reunião marcada" : qualified ? "Oportunidade" : "Marcar como oportunidade"}
      </button>
      <div className="menu-anchor">
        <button type="button" className="btn-line btn-sm" aria-expanded={open} onClick={() => setOpen((o) => !o)} disabled={pending}>
          Mais
        </button>
        {open && (
          <div className="menu" role="menu" style={{ right: "auto", left: 0 }}>
            {status === "NEEDS_HUMAN" ? (
              <button type="button" role="menuitem" onClick={() => run("handback")}>
                Devolver para o assistente
              </button>
            ) : (
              status !== "INVITE_SENT" && (
                <button type="button" role="menuitem" onClick={() => run("takeover")}>
                  Assumir a conversa
                </button>
              )
            )}
            {!meeting && status !== "INVITE_SENT" && (
              <button type="button" role="menuitem" onClick={() => setMeetingOpen((o) => !o)} aria-expanded={meetingOpen}>
                Marcar reunião
              </button>
            )}
            {meetingOpen && (
              <div className="stack" style={{ gap: 8, padding: "6px 10px 10px" }}>
                <label className="label" htmlFor="meeting-when">
                  Dia e hora (opcional)
                </label>
                <input id="meeting-when" type="datetime-local" className="field" value={when} onChange={(e) => setWhen(e.target.value)} />
                <button type="button" className="btn-solid btn-sm" onClick={confirmMeeting} disabled={pending}>
                  Confirmar
                </button>
              </div>
            )}
            {(status === "QUALIFIED" || meeting) && (
              <button type="button" role="menuitem" onClick={() => run("handback")}>
                {meeting ? "Desmarcar reunião" : "Voltar para conversando"}
              </button>
            )}
            {status !== "LOST" && status !== "INVITE_SENT" && (
              <button type="button" className="danger" role="menuitem" onClick={() => run("lost")}>
                Marcar sem resposta
              </button>
            )}
            {profileUrl && (
              <a href={profileUrl} target="_blank" rel="noreferrer" role="menuitem">
                Ver no LinkedIn
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
