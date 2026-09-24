"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { LeadStatus, MessageSender } from "@prisma/client";
import { Avatar } from "@/components/Avatar";
import { IconCheck, IconChevronRight, IconHand, IconInbox, IconRadar, IconSearch, IconSparkles, IconX } from "@/components/Icons";
import { LEAD_SECTIONS, STATUS_TONE } from "@/lib/status";

export interface LeadItem {
  id: string;
  firstName: string | null;
  lastName: string | null;
  jobTitle: string | null;
  status: LeadStatus;
  needsHumanReason: string | null;
  lastMessage: { content: string; sender: MessageSender } | null;
  // Pré-formatado no servidor: evita divergência de hidratação por relógio.
  when: string;
}

export function LeadList({ leads }: { leads: LeadItem[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("all");

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: leads.length };
    for (const section of LEAD_SECTIONS) {
      map[section.key] = leads.filter((l) => section.statuses.includes(l.status)).length;
    }
    return map;
  }, [leads]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) =>
      [l.firstName, l.lastName, l.jobTitle].filter(Boolean).join(" ").toLowerCase().includes(q),
    );
  }, [leads, query]);

  if (leads.length === 0) {
    return (
      <div className="card empty rise">
        <div className="empty-icon">
          <IconInbox size={32} />
        </div>
        <div className="title-md">Nenhum lead ainda</div>
        <p className="small muted" style={{ maxWidth: 280 }}>
          Assim que alguém aceitar um convite ou responder, a conversa aparece aqui.
        </p>
        <Link href="/prospect" className="btn btn-primary" style={{ marginTop: 10 }}>
          <IconRadar size={18} />
          Começar prospecção
        </Link>
      </div>
    );
  }

  const sections = LEAD_SECTIONS.filter((s) => filter === "all" || s.key === filter)
    .map((s) => ({ ...s, items: visible.filter((l) => s.statuses.includes(l.status)) }))
    .filter((s) => s.items.length > 0);

  let index = 0;

  return (
    <>
      <div className="stack" style={{ gap: 12 }}>
        <div className="input-wrap">
          <IconSearch size={19} />
          <input
            className="input search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, cargo ou empresa"
            aria-label="Buscar leads"
          />
          {query && (
            <button type="button" className="icon-btn icon-btn-round input-action" style={{ width: 34, height: 34, boxShadow: "none" }} onClick={() => setQuery("")} aria-label="Limpar busca">
              <IconX size={16} />
            </button>
          )}
        </div>

        <div className="chips" role="toolbar" aria-label="Filtrar por status">
          <button type="button" className="chip" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
            Todos <span className="chip-count">{counts.all}</span>
          </button>
          {LEAD_SECTIONS.map((s) =>
            counts[s.key] > 0 ? (
              <button key={s.key} type="button" className="chip" aria-pressed={filter === s.key} onClick={() => setFilter(s.key)}>
                {s.label} <span className="chip-count">{counts[s.key]}</span>
              </button>
            ) : null,
          )}
        </div>
      </div>

      {sections.length === 0 && (
        <div className="empty">
          <p className="title-md">Nada encontrado</p>
          <p className="small muted">Nenhum lead corresponde a &ldquo;{query}&rdquo;.</p>
        </div>
      )}

      {sections.map((section) => (
        <section key={section.key}>
          <div className="section-head">
            <h2 className="section-title" style={section.key === "urgent" ? { color: "var(--urgent-ink)" } : undefined}>
              {section.key === "urgent" && <IconHand size={16} />}
              {section.label}
              <span className="count">{section.items.length}</span>
            </h2>
          </div>

          {section.key === "urgent" ? (
            <div className="stack" style={{ gap: 10 }}>
              {section.items.map((lead) => (
                <Link
                  key={lead.id}
                  href={`/leads/${lead.id}`}
                  className="urgent-card rise"
                  style={{ "--i": index++ } as React.CSSProperties}
                >
                  <div className="row" style={{ gap: 12 }}>
                    <Avatar firstName={lead.firstName} lastName={lead.lastName} size={46} status="urgent" />
                    <div className="lead-main">
                      <div className="lead-top">
                        <span className="lead-name">
                          {lead.firstName} {lead.lastName}
                        </span>
                        <span className="lead-time">{lead.when}</span>
                      </div>
                      {lead.jobTitle && <div className="lead-sub">{lead.jobTitle}</div>}
                    </div>
                  </div>
                  <div className="reason">
                    <IconSparkles size={16} />
                    <span>{lead.needsHumanReason ?? "Precisa da sua resposta"}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <ul className="list">
              {section.items.map((lead) => (
                <li key={lead.id} className="rise" style={{ "--i": index++ } as React.CSSProperties}>
                  <Link href={`/leads/${lead.id}`} className="lead-row">
                    <Avatar firstName={lead.firstName} lastName={lead.lastName} size={44} status={STATUS_TONE[lead.status]} />
                    <div className="lead-main">
                      <div className="lead-top">
                        <span className="lead-name">
                          {lead.firstName} {lead.lastName}
                        </span>
                        {lead.status === "QUALIFIED" && (
                          <span className="qualified-mark" title="Qualificado" aria-label="Qualificado">
                            <IconCheck size={11} strokeWidth={3.5} />
                          </span>
                        )}
                        <span className="lead-time">{lead.when}</span>
                      </div>
                      <div className="lead-sub">
                        {lead.lastMessage ? (
                          <>
                            {lead.lastMessage.sender !== "LEAD" && <b>{lead.lastMessage.sender === "AGENT" ? "IA: " : "Você: "}</b>}
                            {lead.lastMessage.content}
                          </>
                        ) : (
                          lead.jobTitle ?? "Aguardando aceite do convite"
                        )}
                      </div>
                    </div>
                    <IconChevronRight size={18} className="chev" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </>
  );
}
