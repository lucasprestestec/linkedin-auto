"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ConvItem } from "@/lib/conversations";
import { ConversationRow } from "./ConversationRow";
import { IconFilter, IconInbox, IconPlus, IconSearch, IconX } from "./Icons";

const GROUPS = [
  { key: "all", label: "Todas", test: () => true },
  { key: "urgent", label: "Precisa de você", test: (c: ConvItem) => c.status === "NEEDS_HUMAN" },
  { key: "replied", label: "Respondidas", test: (c: ConvItem) => c.replied && c.status !== "NEEDS_HUMAN" },
  { key: "waiting", label: "Aguardando", test: (c: ConvItem) => c.status === "WAITING_REPLY" },
  { key: "invited", label: "Convites", test: (c: ConvItem) => c.status === "INVITE_SENT" },
  { key: "lost", label: "Sem resposta", test: (c: ConvItem) => c.status === "LOST" },
] as const;
type GroupKey = (typeof GROUPS)[number]["key"];

// Lista de conversas: chips de grupo, busca e (se houver) filtro por campanha
// ou etiqueta. Usada na página Conversas e ao lado do chat no computador.
export function ConversationList({
  items,
  activeId,
  initialQuery = "",
  initialGroup = "all",
  pane = false,
}: {
  items: ConvItem[];
  activeId?: string;
  initialQuery?: string;
  initialGroup?: string;
  pane?: boolean;
}) {
  const [group, setGroup] = useState<GroupKey>(GROUPS.some((g) => g.key === initialGroup) ? (initialGroup as GroupKey) : "all");
  const [query, setQuery] = useState(initialQuery);
  const [campaign, setCampaign] = useState("");
  const [tag, setTag] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const campaigns = useMemo(
    () => [...new Map(items.filter((i) => i.campaignId).map((i) => [i.campaignId!, i.campaignName ?? ""])).entries()],
    [items],
  );
  const tags = useMemo(() => [...new Set(items.flatMap((i) => i.tags))].sort(), [items]);
  const hasFilters = campaigns.length > 0 || tags.length > 0;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const test = GROUPS.find((g) => g.key === group)!.test;
    return items.filter(
      (c) =>
        test(c) &&
        (!campaign || (campaign === "none" ? !c.campaignId : c.campaignId === campaign)) &&
        (!tag || c.tags.includes(tag)) &&
        (!q || [c.firstName, c.lastName, c.role, c.company, c.campaignName, ...c.tags].filter(Boolean).join(" ").toLowerCase().includes(q)),
    );
  }, [items, group, query, campaign, tag]);

  return (
    <section className={`conv-list${pane ? " pane" : ""}`} aria-label="Conversas">
      {pane && (
        <div className="conv-pane-head only-desktop">
          <h2 className="display">Conversas</h2>
          <Link href="/prospect" className="square-btn brand" aria-label="Adicionar pessoas" title="Adicionar pessoas">
            <IconPlus size={18} />
          </Link>
        </div>
      )}

      <div className="chip-row" role="toolbar" aria-label="Mostrar">
        {GROUPS.map((g) => {
          const count = items.filter(g.test).length;
          if (g.key !== "all" && count === 0) return null;
          return (
            <button
              key={g.key}
              type="button"
              className={`chip${g.key === "urgent" ? " chip-urgent" : ""}`}
              aria-pressed={group === g.key}
              onClick={() => setGroup(g.key)}
            >
              {g.label} <span className="chip-count">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="row" style={{ gap: 8 }}>
        <label className="pill-input">
          <IconSearch size={17} />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome, cargo ou empresa..." aria-label="Buscar conversas" />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Limpar busca">
              <IconX size={14} />
            </button>
          )}
        </label>
        {hasFilters && (
          <button
            type="button"
            className="square-btn"
            aria-label="Filtrar por campanha ou etiqueta"
            aria-expanded={filtersOpen}
            aria-pressed={filtersOpen || Boolean(campaign || tag)}
            onClick={() => setFiltersOpen((o) => !o)}
          >
            <IconFilter size={17} />
          </button>
        )}
      </div>

      {filtersOpen && (
        <div className="conv-filters">
          {campaigns.length > 0 && (
            <label className="field" style={{ gap: 4 }}>
              <span className="label">Campanha</span>
              <select className="input" value={campaign} onChange={(e) => setCampaign(e.target.value)}>
                <option value="">Todas</option>
                <option value="none">Sem campanha</option>
                {campaigns.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {tags.length > 0 && (
            <label className="field" style={{ gap: 4 }}>
              <span className="label">Etiqueta</span>
              <select className="input" value={tag} onChange={(e) => setTag(e.target.value)}>
                <option value="">Todas</option>
                {tags.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="empty-line" style={{ flexDirection: "column", alignItems: "flex-start" }}>
          <span className="row" style={{ gap: 8 }}>
            <IconInbox size={18} /> {items.length === 0 ? "Nenhuma conversa ainda." : "Nada encontrado com esses filtros."}
          </span>
          {items.length === 0 && (
            <Link href="/prospect" className="btn btn-primary btn-sm">
              <IconPlus size={16} /> Adicionar pessoas
            </Link>
          )}
        </div>
      ) : (
        <ul className="rows conv-rows">
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
