"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { LeadStatus, MessageSender } from "@prisma/client";
import { Avatar } from "@/components/Avatar";
import { IconCheck, IconChevronRight, IconHand, IconInbox, IconRadar, IconSearch, IconSparkles, IconX } from "@/components/Icons";
import { LEAD_SECTIONS, STATUS_LABEL, STATUS_TONE, type LeadSection } from "@/lib/status";
import { useRouter } from "next/navigation";

export interface LeadItem {
  id: string;
  firstName: string | null;
  lastName: string | null;
  jobTitle: string | null;
  status: LeadStatus;
  needsHumanReason: string | null;
  followUpsSent: number;
  tags: string[];
  campaignName: string | null;
  icpScore: number | null;
  lastMessage: { content: string; sender: MessageSender } | null;
  // Pré-formatado no servidor: evita divergência de hidratação por relógio.
  when: string;
}

export function LeadList({ leads, followUpMax }: { leads: LeadItem[]; followUpMax: number }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const allTags = useMemo(() => [...new Set(leads.flatMap((l) => l.tags))].sort(), [leads]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: leads.length };
    for (const section of LEAD_SECTIONS) {
      map[section.key] = leads.filter((l) => section.statuses.includes(l.status)).length;
    }
    return map;
  }, [leads]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter(
      (l) =>
        (!tagFilter || l.tags.includes(tagFilter)) &&
        (!q || [l.firstName, l.lastName, l.jobTitle, ...l.tags].filter(Boolean).join(" ").toLowerCase().includes(q)),
    );
  }, [leads, query, tagFilter]);

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
            <button
              type="button"
              className="icon-btn icon-btn-round input-action"
              style={{ width: 34, height: 34, boxShadow: "none" }}
              onClick={() => setQuery("")}
              aria-label="Limpar busca"
            >
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

        {allTags.length > 0 && (
          <div className="chips" role="toolbar" aria-label="Filtrar por etiqueta">
            {allTags.map((t) => (
              <button
                key={t}
                type="button"
                className="chip"
                style={{ height: 32, fontSize: 12.5 }}
                aria-pressed={tagFilter === t}
                onClick={() => setTagFilter(tagFilter === t ? null : t)}
              >
                # {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {sections.length === 0 && (
        <div className="empty">
          <p className="title-md">Nada encontrado</p>
          <p className="small muted">Nenhum lead corresponde {query ? <>a &ldquo;{query}&rdquo;</> : "ao filtro"}.</p>
        </div>
      )}

      <LeadTable sections={sections} followUpMax={followUpMax} />

      <div className="only-mobile stack" style={{ gap: 20 }}>
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
                        {lead.followUpsSent > 0 && (lead.status === "WAITING_REPLY" || lead.status === "CONVERSATION_OPEN") && (
                          <span className="badge badge-waiting" style={{ alignSelf: "flex-start", height: 22, marginBottom: 1 }}>
                            Follow-up {lead.followUpsSent}/{followUpMax}
                          </span>
                        )}
                        <div className="lead-sub">
                          {lead.lastMessage ? (
                            <>
                              {lead.lastMessage.sender !== "LEAD" && <b>{lead.lastMessage.sender === "AGENT" ? "IA: " : "Você: "}</b>}
                              {lead.lastMessage.content}
                            </>
                          ) : lead.status === "WAITING_REPLY" || lead.status === "CONVERSATION_OPEN" ? (
                            "Conexão aceita · a IA vai abrir a conversa"
                          ) : (
                            (lead.jobTitle ?? (lead.status === "INVITE_SENT" ? "Aguardando aceite do convite" : ""))
                          )}
                        </div>
                        {lead.tags.length > 0 && (
                          <div className="row" style={{ gap: 4, flexWrap: "wrap", marginTop: 3 }}>
                            {lead.tags.slice(0, 3).map((t) => (
                              <span key={t} className="tag">
                                # {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <IconChevronRight size={18} className="chev" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </>
  );
}

// Computador: tabela densa (estilo CRM) com as mesmas seções e filtros da
// lista do celular. A linha inteira abre a conversa; o link no nome garante
// teclado e leitor de tela.
function LeadTable({ sections, followUpMax }: { sections: (LeadSection & { items: LeadItem[] })[]; followUpMax: number }) {
  const router = useRouter();
  if (sections.length === 0) return null;

  return (
    <div className="card only-desktop lead-table-wrap">
      <table className="lead-table">
        {/* Larguras fixas; a coluna da mensagem absorve o que sobra. */}
        <colgroup>
          <col style={{ width: "24%" }} />
          <col style={{ width: 170 }} />
          <col />
          <col style={{ width: 140 }} />
          <col style={{ width: 150 }} />
          <col style={{ width: 84 }} />
          <col style={{ width: 96 }} />
        </colgroup>
        <thead>
          <tr>
            <th>Lead</th>
            <th>Status</th>
            <th>Última mensagem</th>
            <th>Campanha</th>
            <th>Etiquetas</th>
            <th className="num">Encaixe</th>
            <th className="num">Atividade</th>
          </tr>
        </thead>
        {sections.map((section) => (
          <tbody key={section.key}>
            <tr className="lead-table-group">
              <th colSpan={7}>
                {section.label} <span className="count">{section.items.length}</span>
              </th>
            </tr>
            {section.items.map((lead) => (
              <tr
                key={lead.id}
                onClick={() => router.push(`/leads/${lead.id}`)}
                className={lead.status === "NEEDS_HUMAN" ? "urgent" : undefined}
              >
                <td>
                  <div className="row" style={{ gap: 12 }}>
                    <Avatar firstName={lead.firstName} lastName={lead.lastName} size={36} status={STATUS_TONE[lead.status]} />
                    <div className="stack" style={{ minWidth: 0 }}>
                      <Link href={`/leads/${lead.id}`} className="lead-name" style={{ fontSize: 14 }} onClick={(e) => e.stopPropagation()}>
                        {lead.firstName} {lead.lastName}
                      </Link>
                      {lead.jobTitle && <span className="tiny faint truncate">{lead.jobTitle}</span>}
                    </div>
                  </div>
                </td>
                <td>
                  <div className="stack" style={{ gap: 4, alignItems: "flex-start" }}>
                    <span className={`badge badge-${STATUS_TONE[lead.status]}`}>{STATUS_LABEL[lead.status]}</span>
                    {lead.followUpsSent > 0 && (lead.status === "WAITING_REPLY" || lead.status === "CONVERSATION_OPEN") && (
                      <span className="tiny faint">
                        Follow-up {lead.followUpsSent}/{followUpMax}
                      </span>
                    )}
                  </div>
                </td>
                <td className="lead-table-msg">
                  {lead.status === "NEEDS_HUMAN" && lead.needsHumanReason ? (
                    <span style={{ color: "var(--urgent-ink)", fontWeight: 600 }}>{lead.needsHumanReason}</span>
                  ) : lead.lastMessage ? (
                    <>
                      {lead.lastMessage.sender !== "LEAD" && <b>{lead.lastMessage.sender === "AGENT" ? "IA: " : "Você: "}</b>}
                      {lead.lastMessage.content}
                    </>
                  ) : (
                    <span className="faint">—</span>
                  )}
                </td>
                <td>{lead.campaignName ?? <span className="faint">—</span>}</td>
                <td>
                  <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
                    {lead.tags.slice(0, 3).map((t) => (
                      <span key={t} className="tag">
                        # {t}
                      </span>
                    ))}
                    {lead.tags.length === 0 && <span className="faint">—</span>}
                  </div>
                </td>
                <td className="num">{lead.icpScore != null ? `${lead.icpScore}%` : <span className="faint">—</span>}</td>
                <td className="num faint">{lead.when}</td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
