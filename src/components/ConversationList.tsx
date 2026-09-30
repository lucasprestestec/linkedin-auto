"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ConvItem } from "@/lib/conversations";
import { ConversationRow } from "./ConversationRow";

const GROUPS = [
  { key: "all", label: "Todas", test: () => true },
  { key: "urgent", label: "Precisa de você", test: (c: ConvItem) => c.status === "NEEDS_HUMAN" },
  { key: "replied", label: "Responderam", test: (c: ConvItem) => c.replied && c.status !== "NEEDS_HUMAN" },
  { key: "waiting", label: "Aguardando", test: (c: ConvItem) => c.status === "WAITING_REPLY" || c.status === "INVITE_SENT" },
  { key: "lost", label: "Sem resposta", test: (c: ConvItem) => c.status === "LOST" },
] as const;
type GroupKey = (typeof GROUPS)[number]["key"];

// Lista de conversas com abas e busca. Usada na tela Conversas e ao lado do chat.
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
  const [group, setGroup] = useState<GroupKey>(GROUPS.some((g) => g.key === initialGroup) ? (initialGroup as GroupKey) : "all");
  const [query, setQuery] = useState(initialQuery);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const test = GROUPS.find((g) => g.key === group)!.test;
    return items.filter((c) => test(c) && (!q || [c.firstName, c.lastName, c.role, c.company, c.campaignName, ...c.tags].filter(Boolean).join(" ").toLowerCase().includes(q)));
  }, [items, group, query]);

  return (
    <section className="stack" aria-label="Conversas">
      <input className="search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar" aria-label="Buscar conversas" />

      <div className="tabs" role="toolbar" aria-label="Mostrar">
        {GROUPS.map((g) => {
          const count = items.filter(g.test).length;
          if (g.key !== "all" && count === 0) return null;
          return (
            <button key={g.key} type="button" aria-pressed={group === g.key} onClick={() => setGroup(g.key)}>
              {g.label}
              <span className="count">{count}</span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <p className="empty card">
          {items.length === 0 ? (
            <>
              Nenhuma conversa ainda. <Link href="/prospect" className="btn-text">Adicionar pessoas</Link>
            </>
          ) : (
            "Nada encontrado."
          )}
        </p>
      ) : (
        <ul className="list card card-flush">
          {visible.map((c) => (
            <li key={c.id}>
              <ConversationRow c={c} active={c.id === activeId} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
