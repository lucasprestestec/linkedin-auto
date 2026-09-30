"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { LeadStatus } from "@prisma/client";
import { IconBan, IconBot, IconCalendar, IconCheck, IconChevronDown, IconExternal, IconHand } from "@/components/Icons";
import { leadAction, markMeeting, type LeadActionKind } from "./actions";

// Botão principal + "Mais ações". Qualificar tira o lead da automação
// proativa; assumir faz a IA parar de responder até você devolver.
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
    <div className="lead-actions" ref={ref}>
      <button type="button" className="btn btn-primary lead-action-main" disabled={pending || qualified} onClick={() => run("qualify")}>
        <IconCheck size={18} strokeWidth={2.6} /> {meeting ? "Reunião marcada" : qualified ? "Qualificado" : "Marcar qualificado"}
      </button>
      <div className="popover-anchor">
        <button type="button" className="btn btn-secondary lead-action-more" aria-expanded={open} onClick={() => setOpen((o) => !o)} disabled={pending}>
          Mais ações <IconChevronDown size={16} />
        </button>
        {open && (
          <div className="popover" role="menu" style={{ width: 250 }}>
            {status === "NEEDS_HUMAN" ? (
              <button type="button" className="menu-item" role="menuitem" onClick={() => run("handback")}>
                <IconBot size={16} /> Devolver para a IA
              </button>
            ) : (
              status !== "INVITE_SENT" && (
                <button type="button" className="menu-item" role="menuitem" onClick={() => run("takeover")}>
                  <IconHand size={16} /> Assumir conversa
                </button>
              )
            )}
            {!meeting && status !== "INVITE_SENT" && (
              <button type="button" className="menu-item" role="menuitem" onClick={() => setMeetingOpen((o) => !o)} aria-expanded={meetingOpen}>
                <IconCalendar size={16} /> Marcar reunião
              </button>
            )}
            {meetingOpen && (
              <div className="stack" style={{ gap: 8, padding: "6px 12px 10px" }}>
                <label className="tiny faint" htmlFor="meeting-when">
                  Dia e hora (opcional)
                </label>
                <input id="meeting-when" type="datetime-local" className="input" value={when} onChange={(e) => setWhen(e.target.value)} />
                <button type="button" className="btn btn-primary btn-sm" onClick={confirmMeeting} disabled={pending}>
                  Confirmar reunião
                </button>
              </div>
            )}
            {(status === "QUALIFIED" || meeting) && (
              <button type="button" className="menu-item" role="menuitem" onClick={() => run("handback")}>
                <IconBot size={16} /> {meeting ? "Desmarcar reunião" : <>Voltar para &ldquo;Conversando&rdquo;</>}
              </button>
            )}
            {status !== "LOST" && status !== "INVITE_SENT" && (
              <button type="button" className="menu-item danger" role="menuitem" onClick={() => run("lost")}>
                <IconBan size={16} /> Marcar sem resposta
              </button>
            )}
            {profileUrl && (
              <a href={profileUrl} target="_blank" rel="noreferrer" className="menu-item" role="menuitem">
                <IconExternal size={16} /> Ver no LinkedIn
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
