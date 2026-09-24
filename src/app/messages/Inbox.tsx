"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { LeadStatus, MessageSender } from "@prisma/client";
import { Avatar } from "@/components/Avatar";
import { IconInbox, IconSearch } from "@/components/Icons";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/status";

export interface InboxItem {
  id: string;
  firstName: string | null;
  lastName: string | null;
  subtitle: string;
  status: LeadStatus;
  needsHumanReason: string | null;
  last: { content: string; sender: MessageSender };
  when: string;
  ts: number;
}

const FILTERS = {
  all: { label: "Todas", test: () => true },
  unanswered: { label: "Sem resposta sua", test: (i: InboxItem) => i.last.sender === "LEAD" },
  urgent: { label: "Precisa de você", test: (i: InboxItem) => i.status === "NEEDS_HUMAN" },
  ai: { label: "Com a IA", test: (i: InboxItem) => i.status === "CONVERSATION_OPEN" || i.status === "WAITING_REPLY" },
} as const;
type FilterKey = keyof typeof FILTERS;

export function Inbox({ items }: { items: InboxItem[] }) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) => FILTERS[filter].test(i) && (!q || `${i.firstName ?? ""} ${i.lastName ?? ""} ${i.subtitle} ${i.last.content}`.toLowerCase().includes(q)),
    );
  }, [items, filter, query]);

  return (
    <section className="leads-card expanded inbox">
      <div className="leads-head">
        <div className="chips" role="toolbar" aria-label="Filtrar conversas">
          {(Object.keys(FILTERS) as FilterKey[]).map((k) => {
            const count = items.filter(FILTERS[k].test).length;
            return (
              <button key={k} type="button" className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>
                {FILTERS[k].label} <span className="chip-count">{count}</span>
              </button>
            );
          })}
        </div>
        <label className="pill-input inbox-search">
          <IconSearch size={18} />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar nas conversas..." aria-label="Buscar nas conversas" />
        </label>
      </div>

      {visible.length === 0 ? (
        <div className="empty" style={{ padding: "40px 16px" }}>
          <div className="empty-icon">
            <IconInbox size={30} />
          </div>
          <p className="title-md">Nenhuma conversa aqui</p>
          <p className="small muted">Quando os leads responderem, as conversas aparecem nesta caixa.</p>
        </div>
      ) : (
        <ul className="inbox-list">
          {visible.map((i) => {
            const unread = i.last.sender === "LEAD";
            return (
              <li key={i.id}>
                <Link href={`/leads/${i.id}`} className={`inbox-row${unread ? " unread" : ""}`}>
                  <Avatar firstName={i.firstName} lastName={i.lastName} size={54} status={STATUS_TONE[i.status]} />
                  <div className="inbox-main">
                    <div className="lead-card-top">
                      <span className="lead-card-name">
                        {i.firstName} {i.lastName}
                      </span>
                      <span className="lead-card-time">{i.when}</span>
                    </div>
                    {i.subtitle && <span className="inbox-sub">{i.subtitle}</span>}
                    <span className="inbox-preview">
                      {i.status === "NEEDS_HUMAN" && i.needsHumanReason ? (
                        <span className="preview-urgent">{i.needsHumanReason}</span>
                      ) : (
                        <>
                          {i.last.sender !== "LEAD" && <b>{i.last.sender === "AGENT" ? "IA: " : "Você: "}</b>}
                          {i.last.content}
                        </>
                      )}
                    </span>
                  </div>
                  <div className="inbox-side">
                    <span className={`status-pill pill-${STATUS_TONE[i.status]} only-desktop`}>{STATUS_LABEL[i.status]}</span>
                    {unread && <span className="unread-dot" aria-label="Aguardando sua resposta" />}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
