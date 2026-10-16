"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ConvItem } from "@/lib/conversations";
import { ConversationCard, ConversationRow } from "./ConversationRow";
import { IconSearch } from "./Icons";

// Cada conversa cai em UM grupo, na ordem do que pede a sua atenção.
export const BUCKETS = [
  { key: "urgent", label: "Com você", test: (c: ConvItem) => c.status === "NEEDS_HUMAN" || (c.unanswered && c.status !== "LOST" && c.status !== "QUALIFIED" && c.status !== "MEETING_SCHEDULED") },
  { key: "open", label: "Em conversa", test: (c: ConvItem) => c.status === "CONVERSATION_OPEN" },
  { key: "waiting", label: "Aguardando", test: (c: ConvItem) => c.status === "WAITING_REPLY" || c.status === "INVITE_SENT" || c.status === "NEW" },
  { key: "win", label: "Oportunidades", test: (c: ConvItem) => c.status === "QUALIFIED" || c.status === "MEETING_SCHEDULED" },
  { key: "lost", label: "Sem resposta", test: (c: ConvItem) => c.status === "LOST" },
] as const;
type BucketKey = (typeof BUCKETS)[number]["key"];

function bucketOf(c: ConvItem): BucketKey {
  return BUCKETS.find((b) => b.test(c))?.key ?? "waiting";
}

function groupBy(items: ConvItem[]) {
  const map = new Map<BucketKey, ConvItem[]>(BUCKETS.map((b) => [b.key, []]));
  for (const c of items) map.get(bucketOf(c))!.push(c);
  return map;
}

// Endereços antigos (?status=replied etc.) continuam funcionando.
function initialFilter(raw: string): BucketKey | "all" {
  if (raw === "replied") return "open";
  return BUCKETS.some((b) => b.key === raw) ? (raw as BucketKey) : "all";
}

// Lista de conversas: busca, "Todas" e "Com você" à mão, os outros grupos num seletor.
export function ConversationList({ items, activeId, initialQuery = "", initialGroup = "all" }: { items: ConvItem[]; activeId?: string; initialQuery?: string; initialGroup?: string }) {
  const [filter, setFilter] = useState<BucketKey | "all">(initialFilter(initialGroup));
  const [query, setQuery] = useState(initialQuery);

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((c) => [c.firstName, c.lastName, c.role, c.company, c.campaignName, ...c.tags].filter(Boolean).join(" ").toLowerCase().includes(q));
  }, [items, query]);

  const byBucket = useMemo(() => groupBy(searched), [searched]);
  const count = (k: BucketKey) => byBucket.get(k)!.length;
  const shown = BUCKETS.filter((b) => (filter === "all" || filter === b.key) && count(b.key) > 0);
  const others = BUCKETS.filter((b) => b.key !== "urgent");

  return (
    <>
      <label className="srch">
        <IconSearch size={18} />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar pessoa ou empresa" aria-label="Buscar conversas" />
      </label>
      <div className="filters" role="group" aria-label="Mostrar">
        <button type="button" className="chip" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
          Todas
        </button>
        <button type="button" className="chip" aria-pressed={filter === "urgent"} onClick={() => setFilter("urgent")}>
          Com você · {count("urgent")}
        </button>
        <select className="chip sel-chip" aria-label="Outros grupos" value={others.some((b) => b.key === filter) ? filter : ""} onChange={(e) => setFilter((e.target.value || "all") as BucketKey | "all")}>
          <option value="">Mais grupos</option>
          {others.map((b) => (
            <option key={b.key} value={b.key}>
              {b.label} · {count(b.key)}
            </option>
          ))}
        </select>
      </div>

      {searched.length === 0 ? (
        <p className="empty c-empty">
          {items.length === 0 ? (
            <>
              Nenhuma conversa ainda. <Link href="/contacts" className="btn-text">Adicionar pessoas</Link>
            </>
          ) : (
            "Nada encontrado."
          )}
        </p>
      ) : shown.length === 0 ? (
        <p className="empty c-empty">Nenhuma conversa neste grupo.</p>
      ) : (
        <div className="c-scroll">
          {shown.map((b) => (
            <div key={b.key} className="c-group">
              {filter === "all" && (
                <h3 className="c-group-h">
                  {b.label}
                  <span>{count(b.key)}</span>
                </h3>
              )}
              <ul className="c-ul">
                {byBucket.get(b.key)!.map((c) => (
                  <li key={c.id}>
                    <ConversationRow c={c} active={c.id === activeId} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// Quadro (kanban): uma coluna por grupo, todas as conversas de uma vez.
export function ConversationBoard({ items }: { items: ConvItem[] }) {
  const byBucket = groupBy(items);
  return (
    <div className="kanban" role="list" aria-label="Quadro de conversas">
      {BUCKETS.map((b) => (
        <div key={b.key} className="kcol" role="listitem">
          <h3>
            {b.label}
            <span>{byBucket.get(b.key)!.length}</span>
          </h3>
          {byBucket.get(b.key)!.length === 0 ? <p className="kb-empty">Nenhuma</p> : byBucket.get(b.key)!.map((c) => <ConversationCard key={c.id} c={c} />)}
        </div>
      ))}
    </div>
  );
}
