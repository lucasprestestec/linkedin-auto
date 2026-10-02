"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ConvItem } from "@/lib/conversations";
import { ConversationCard, ConversationRow } from "./ConversationRow";
import { IconBars, IconLayers } from "./Icons";

// Cada conversa cai em UM grupo, na ordem do que pede a sua atenção.
const BUCKETS = [
  { key: "urgent", label: "Precisa de você", tone: "danger", test: (c: ConvItem) => c.status === "NEEDS_HUMAN" || (c.unanswered && c.status !== "LOST" && c.status !== "QUALIFIED" && c.status !== "MEETING_SCHEDULED") },
  { key: "open", label: "Em conversa", tone: "accent", test: (c: ConvItem) => c.status === "CONVERSATION_OPEN" },
  { key: "waiting", label: "Aguardando", tone: "neutral", test: (c: ConvItem) => c.status === "WAITING_REPLY" || c.status === "INVITE_SENT" || c.status === "NEW" },
  { key: "win", label: "Oportunidades", tone: "ok", test: (c: ConvItem) => c.status === "QUALIFIED" || c.status === "MEETING_SCHEDULED" },
  { key: "lost", label: "Sem resposta", tone: "muted", test: (c: ConvItem) => c.status === "LOST" },
] as const;
type BucketKey = (typeof BUCKETS)[number]["key"];

function bucketOf(c: ConvItem): BucketKey {
  return BUCKETS.find((b) => b.test(c))?.key ?? "waiting";
}

// Endereços antigos (?status=replied etc.) continuam funcionando.
function initialFilter(raw: string): BucketKey | "all" {
  if (raw === "replied") return "open";
  return BUCKETS.some((b) => b.key === raw) ? (raw as BucketKey) : "all";
}

// Lista de conversas com busca, filtros, grupos coloridos por situação e a opção de ver em quadro (kanban).
export function ConversationList({
  items,
  activeId,
  initialQuery = "",
  initialGroup = "all",
}: {
  items: ConvItem[];
  activeId?: string;
  initialQuery?: string;
  initialGroup?: string;
  pane?: boolean;
}) {
  const [filter, setFilter] = useState<BucketKey | "all">(initialFilter(initialGroup));
  const [query, setQuery] = useState(initialQuery);
  const [view, setView] = useState<"list" | "board">("list");

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((c) => [c.firstName, c.lastName, c.role, c.company, c.campaignName, ...c.tags].filter(Boolean).join(" ").toLowerCase().includes(q));
  }, [items, query]);

  const byBucket = useMemo(() => {
    const map = new Map<BucketKey, ConvItem[]>(BUCKETS.map((b) => [b.key, []]));
    for (const c of searched) map.get(bucketOf(c))!.push(c);
    return map;
  }, [searched]);

  const count = (k: BucketKey) => byBucket.get(k)!.length;
  const shown = BUCKETS.filter((b) => (filter === "all" || filter === b.key) && count(b.key) > 0);

  return (
    <section className="stack" aria-label="Conversas">
      <div className="cv-bar">
        <input className="search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar" aria-label="Buscar conversas" />
        <div className="seg" role="group" aria-label="Como ver">
          <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")} title="Lista">
            <IconBars size={16} />
            <span>Lista</span>
          </button>
          <button type="button" aria-pressed={view === "board"} onClick={() => setView("board")} title="Quadro">
            <IconLayers size={16} />
            <span>Quadro</span>
          </button>
        </div>
      </div>

      {view === "list" && (
        <div className="tabs" role="toolbar" aria-label="Mostrar">
          <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
            Todas
            <span className="count">{searched.length}</span>
          </button>
          {BUCKETS.map((b) =>
            count(b.key) === 0 ? null : (
              <button key={b.key} type="button" aria-pressed={filter === b.key} onClick={() => setFilter(b.key)}>
                <i className={`dot-b b-${b.tone}`} />
                {b.label}
                <span className="count">{count(b.key)}</span>
              </button>
            ),
          )}
        </div>
      )}

      {searched.length === 0 ? (
        <p className="empty card">
          {items.length === 0 ? (
            <>
              Nenhuma conversa ainda. <Link href="/prospect" className="btn-text">Adicionar pessoas</Link>
            </>
          ) : (
            "Nada encontrado."
          )}
        </p>
      ) : view === "list" ? (
        <div className="stack" style={{ gap: 14 }}>
          {shown.map((b) => (
            <div key={b.key} className="cv-group">
              <h3 className="cv-group-head">
                <i className={`dot-b b-${b.tone}`} />
                {b.label}
                <span className="count">{count(b.key)}</span>
              </h3>
              <ul className="list card card-flush">
                {byBucket.get(b.key)!.map((c) => (
                  <li key={c.id}>
                    <ConversationRow c={c} active={c.id === activeId} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <div className="kb" role="list" aria-label="Quadro de conversas">
          {BUCKETS.map((b) => (
            <div key={b.key} className="kb-col" role="listitem">
              <h3 className="cv-group-head">
                <i className={`dot-b b-${b.tone}`} />
                {b.label}
                <span className="count">{count(b.key)}</span>
              </h3>
              <div className="kb-cards">
                {byBucket.get(b.key)!.length === 0 ? <p className="kb-empty">Nenhuma</p> : byBucket.get(b.key)!.map((c) => <ConversationCard key={c.id} c={c} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
