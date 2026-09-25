"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LeadStatus, MessageSender } from "@prisma/client";
import { Avatar } from "@/components/Avatar";
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconDotsVertical,
  IconDownload,
  IconExternal,
  IconFilter,
  IconInbox,
  IconRadar,
  IconSearch,
  IconSparkles,
  IconX,
} from "@/components/Icons";
import { LEAD_SECTIONS, STATUS_LABEL, STATUS_TONE } from "@/lib/status";
import { CompanyMark } from "@/components/CompanyMark";

export interface LeadItem {
  id: string;
  firstName: string | null;
  lastName: string | null;
  jobTitle: string | null;
  role: string | null;
  company: string | null;
  linkedinProfileUrl: string;
  status: LeadStatus;
  needsHumanReason: string | null;
  followUpsSent: number;
  tags: string[];
  campaignName: string | null;
  icpScore: number | null;
  lastMessage: { content: string; sender: MessageSender } | null;
  // Pré-formatado no servidor: evita divergência de hidratação por relógio.
  when: string;
  whenTs: number;
}

const PAGE_SIZE = 8;

const FIT_OPTIONS = [
  { value: 0, label: "Qualquer" },
  { value: 40, label: "40%+" },
  { value: 60, label: "60%+" },
  { value: 80, label: "80%+" },
];
const NO_CAMPAIGN = "__none__";

const SORTS = {
  recent: "Mais recentes",
  urgent: "Precisa de você primeiro",
  fit: "Maior encaixe",
  name: "Nome (A–Z)",
} as const;
type SortKey = keyof typeof SORTS;

interface Filters {
  sections: string[];
  campaigns: string[];
  tags: string[];
  minFit: number;
}
const NO_FILTERS: Filters = { sections: [], campaigns: [], tags: [], minFit: 0 };

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function fullName(l: LeadItem) {
  return [l.firstName, l.lastName].filter(Boolean).join(" ") || "Lead";
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="stack" style={{ gap: 8 }}>
      <span className="label">{label}</span>
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        {children}
      </div>
    </div>
  );
}

function FitCell({ score }: { score: number | null }) {
  if (score == null) return <span className="faint">—</span>;
  const up = score >= 50;
  return (
    <span className="fit-cell">
      {score}%{up ? <IconArrowUpRight size={16} className="fit-up" /> : <IconArrowDownRight size={16} className="fit-down" />}
    </span>
  );
}

function Preview({ lead }: { lead: LeadItem }) {
  if (lead.status === "NEEDS_HUMAN" && lead.needsHumanReason) {
    return <span className="preview-urgent">{lead.needsHumanReason}</span>;
  }
  if (lead.lastMessage) {
    return (
      <>
        {lead.lastMessage.sender !== "LEAD" && <b>{lead.lastMessage.sender === "AGENT" ? "IA: " : "Você: "}</b>}
        {lead.lastMessage.content}
      </>
    );
  }
  if (lead.status === "INVITE_SENT") return <>Aguardando aceite do convite</>;
  return <>Conexão aceita · a IA vai abrir a conversa</>;
}

function RowMenu({ lead }: { lead: LeadItem }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="popover-anchor" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="kebab"
        aria-label={`Ações de ${fullName(lead)}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <IconDotsVertical size={18} />
      </button>
      {open && (
        <div className="popover" role="menu" style={{ width: 220 }}>
          <Link href={`/leads/${lead.id}`} className="menu-item" role="menuitem">
            <IconSparkles size={16} /> Abrir conversa
          </Link>
          <a href={lead.linkedinProfileUrl} target="_blank" rel="noreferrer" className="menu-item" role="menuitem">
            <IconExternal size={16} /> Ver no LinkedIn
          </a>
        </div>
      )}
    </div>
  );
}

function pageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, 2, total - 1, total, current - 1, current, current + 1].filter((p) => p >= 1 && p <= total));
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("…");
    out.push(p);
  });
  return out;
}

export function LeadList({
  leads,
  followUpMax,
  initialQuery = "",
  initialSection = "",
}: {
  leads: LeadItem[];
  followUpMax: number;
  initialQuery?: string;
  initialSection?: string;
}) {
  const router = useRouter();
  const validSection = LEAD_SECTIONS.some((s) => s.key === initialSection);
  const [query, setQuery] = useState(initialQuery);
  const [filters, setFilters] = useState<Filters>(validSection ? { ...NO_FILTERS, sections: [initialSection] } : NO_FILTERS);
  const [panelOpen, setPanelOpen] = useState(false);
  const [sort, setSort] = useState<SortKey>("recent");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allTags = useMemo(() => [...new Set(leads.flatMap((l) => l.tags))].sort(), [leads]);
  const allCampaigns = useMemo(() => [...new Set(leads.flatMap((l) => (l.campaignName ? [l.campaignName] : [])))].sort(), [leads]);
  const hasNoCampaign = leads.some((l) => !l.campaignName);
  const hasFit = leads.some((l) => l.icpScore != null);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const section of LEAD_SECTIONS) map[section.key] = leads.filter((l) => section.statuses.includes(l.status)).length;
    return map;
  }, [leads]);

  // Filtros combinam com E entre grupos e OU dentro do mesmo grupo.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const statuses = filters.sections.length
      ? new Set(LEAD_SECTIONS.filter((s) => filters.sections.includes(s.key)).flatMap((s) => s.statuses))
      : null;
    const list = leads.filter(
      (l) =>
        (!statuses || statuses.has(l.status)) &&
        (filters.tags.length === 0 || filters.tags.some((t) => l.tags.includes(t))) &&
        (filters.campaigns.length === 0 || filters.campaigns.includes(l.campaignName ?? NO_CAMPAIGN)) &&
        (filters.minFit === 0 || (l.icpScore ?? -1) >= filters.minFit) &&
        (!q || [l.firstName, l.lastName, l.jobTitle, l.campaignName, ...l.tags].filter(Boolean).join(" ").toLowerCase().includes(q)),
    );
    const byRecent = (a: LeadItem, b: LeadItem) => b.whenTs - a.whenTs;
    if (sort === "name") return [...list].sort((a, b) => fullName(a).localeCompare(fullName(b), "pt-BR"));
    if (sort === "fit") return [...list].sort((a, b) => (b.icpScore ?? -1) - (a.icpScore ?? -1) || byRecent(a, b));
    if (sort === "urgent")
      return [...list].sort((a, b) => Number(b.status === "NEEDS_HUMAN") - Number(a.status === "NEEDS_HUMAN") || byRecent(a, b));
    return [...list].sort(byRecent);
  }, [leads, query, filters, sort]);

  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const pageItems = visible.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const mobileItems = pageItems;
  const hasExtraFilters = allCampaigns.length > 0 || allTags.length > 0 || hasFit;

  const active: { key: string; label: string; clear: () => void }[] = [
    ...filters.campaigns.map((c) => ({
      key: `c-${c}`,
      label: c === NO_CAMPAIGN ? "Sem campanha" : `Campanha: ${c}`,
      clear: () => setFilters((f) => ({ ...f, campaigns: f.campaigns.filter((x) => x !== c) })),
    })),
    ...filters.tags.map((t) => ({
      key: `t-${t}`,
      label: `# ${t}`,
      clear: () => setFilters((f) => ({ ...f, tags: f.tags.filter((x) => x !== t) })),
    })),
    ...(filters.minFit
      ? [{ key: "fit", label: `Encaixe ${filters.minFit}%+`, clear: () => setFilters((f) => ({ ...f, minFit: 0 })) }]
      : []),
  ];

  function changeFilters(next: (f: Filters) => Filters) {
    setFilters(next);
    setPage(1);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allOnPageSelected = pageItems.length > 0 && pageItems.every((l) => selected.has(l.id));

  if (leads.length === 0) {
    return (
      <section id="leads" className="card empty rise">
        <div className="empty-icon">
          <IconInbox size={32} />
        </div>
        <div className="title-md">Nenhum lead ainda</div>
        <p className="small muted" style={{ maxWidth: 280 }}>
          Assim que alguém aceitar um convite ou responder, a conversa aparece aqui.
        </p>
        <Link href="/campaigns" className="btn btn-primary" style={{ marginTop: 10 }}>
          <IconRadar size={18} />
          Criar uma campanha
        </Link>
      </section>
    );
  }

  return (
    <section id="leads" className="leads-card expanded" aria-label="Conversas">
      {/* Um toque pra ver só um grupo: o filtro mais usado fica sempre à vista. */}
      <div className="status-chips" role="toolbar" aria-label="Mostrar">
        <button
          type="button"
          className="chip"
          aria-pressed={filters.sections.length === 0}
          onClick={() => changeFilters((f) => ({ ...f, sections: [] }))}
        >
          Todas <span className="chip-count">{leads.length}</span>
        </button>
        {LEAD_SECTIONS.filter((s) => counts[s.key] > 0).map((s) => (
          <button
            key={s.key}
            type="button"
            className={`chip${s.key === "urgent" ? " chip-urgent" : ""}`}
            aria-pressed={filters.sections.length === 1 && filters.sections[0] === s.key}
            onClick={() => changeFilters((f) => ({ ...f, sections: [s.key] }))}
          >
            {s.label} <span className="chip-count">{counts[s.key]}</span>
          </button>
        ))}
      </div>
      <div className="leads-head">
        <div className="leads-controls">
          <label className="pill-input">
            <IconSearch size={18} />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Filtrar por nome, cargo ou empresa..."
              aria-label="Filtrar leads"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Limpar busca">
                <IconX size={14} />
              </button>
            )}
          </label>
          <label className="pill-select">
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Ordenar">
              {Object.entries(SORTS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            <IconChevronDown size={16} />
          </label>
          {hasExtraFilters && (
            <button
              type="button"
              className="square-btn"
              aria-label="Mais filtros"
              aria-expanded={panelOpen}
              aria-controls="lead-filters"
              aria-pressed={panelOpen || active.length > 0}
              onClick={() => setPanelOpen((o) => !o)}
            >
              <IconFilter size={18} />
              {active.length > 0 && <span className="square-btn-count">{active.length}</span>}
            </button>
          )}
        </div>
      </div>

      {(active.length > 0 || selected.size > 0) && (
        <div className="row leads-chips" style={{ gap: 8, flexWrap: "wrap" }}>
          {selected.size > 0 && (
            <span className="bulk-bar">
              <b>
                {selected.size} selecionado{selected.size > 1 ? "s" : ""}
              </b>
              <a href={`/api/export/leads?ids=${[...selected].join(",")}`} download className="bulk-action">
                <IconDownload size={15} /> Exportar
              </a>
              <button type="button" className="bulk-action" onClick={() => setSelected(new Set())}>
                Limpar
              </button>
            </span>
          )}
          {active.map((f) => (
            <span key={f.key} className="tag-pill" style={{ height: 34, borderRadius: 999, paddingLeft: 14 }}>
              {f.label}
              <button type="button" onClick={f.clear} aria-label={`Tirar filtro ${f.label}`}>
                <IconX size={12} strokeWidth={2.6} />
              </button>
            </span>
          ))}
          {active.length > 1 && (
            <button type="button" className="link-btn" onClick={() => changeFilters(() => NO_FILTERS)}>
              Limpar tudo
            </button>
          )}
        </div>
      )}

      {panelOpen && (
        <div id="lead-filters" className="filter-panel stack" style={{ gap: 16 }}>
          {allCampaigns.length > 0 && (
            <FilterGroup label="Campanha">
              {[...allCampaigns, ...(hasNoCampaign ? [NO_CAMPAIGN] : [])].map((c) => (
                <button
                  key={c}
                  type="button"
                  className="chip"
                  aria-pressed={filters.campaigns.includes(c)}
                  onClick={() => changeFilters((f) => ({ ...f, campaigns: toggle(f.campaigns, c) }))}
                >
                  {c === NO_CAMPAIGN ? "Sem campanha" : c}
                </button>
              ))}
            </FilterGroup>
          )}
          {allTags.length > 0 && (
            <FilterGroup label="Etiquetas">
              {allTags.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="chip"
                  aria-pressed={filters.tags.includes(t)}
                  onClick={() => changeFilters((f) => ({ ...f, tags: toggle(f.tags, t) }))}
                >
                  # {t}
                </button>
              ))}
            </FilterGroup>
          )}
          {hasFit && (
            <FilterGroup label="Encaixe mínimo com o cliente ideal">
              {FIT_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className="chip"
                  aria-pressed={filters.minFit === o.value}
                  onClick={() => changeFilters((f) => ({ ...f, minFit: o.value }))}
                >
                  {o.label}
                </button>
              ))}
            </FilterGroup>
          )}
          <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
            <span className="tiny faint">
              {visible.length} de {leads.length} leads
            </span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPanelOpen(false)}>
              Pronto
            </button>
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="empty" style={{ padding: "32px 16px" }}>
          <p className="title-md">Nada encontrado</p>
          <p className="small muted">Nenhum lead corresponde {query ? <>a &ldquo;{query}&rdquo;</> : "aos filtros"}.</p>
        </div>
      ) : (
        <>
          {/* Computador: tabela */}
          <div className="only-desktop lead-table-scroll">
            <table className="leads-table">
              <colgroup>
                <col style={{ width: 44 }} />
                <col style={{ width: "22%" }} />
                <col style={{ width: "21%" }} />
                <col />
                <col style={{ width: 176 }} />
                <col style={{ width: 96 }} />
                <col style={{ width: 48 }} />
              </colgroup>
              <thead>
                <tr>
                  <th>
                    <label className="table-check">
                      <input
                        type="checkbox"
                        checked={allOnPageSelected}
                        onChange={() =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            for (const l of pageItems) {
                              if (allOnPageSelected) next.delete(l.id);
                              else next.add(l.id);
                            }
                            return next;
                          })
                        }
                        aria-label="Selecionar todos desta página"
                      />
                      <span className="checkbox">
                        <IconCheck size={13} strokeWidth={3.2} />
                      </span>
                    </label>
                  </th>
                  <th>Perfil</th>
                  <th>Cargo / Empresa</th>
                  <th>Última mensagem</th>
                  <th>Status</th>
                  <th>Encaixe</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {pageItems.map((lead) => (
                  <tr key={lead.id} onClick={() => router.push(`/leads/${lead.id}`)} aria-selected={selected.has(lead.id)}>
                    <td onClick={(e) => e.stopPropagation()}>
                      <label className="table-check">
                        <input
                          type="checkbox"
                          checked={selected.has(lead.id)}
                          onChange={() => toggleSelect(lead.id)}
                          aria-label={`Selecionar ${fullName(lead)}`}
                        />
                        <span className="checkbox">
                          <IconCheck size={13} strokeWidth={3.2} />
                        </span>
                      </label>
                    </td>
                    <td>
                      <div className="row" style={{ gap: 14 }}>
                        <Avatar firstName={lead.firstName} lastName={lead.lastName} size={52} status={STATUS_TONE[lead.status]} />
                        <div className="stack" style={{ minWidth: 0 }}>
                          <Link href={`/leads/${lead.id}`} className="cell-strong truncate" onClick={(e) => e.stopPropagation()}>
                            {fullName(lead)}
                          </Link>
                          <span className="cell-sub">{lead.when}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="row" style={{ gap: 12 }}>
                        {lead.company && <CompanyMark name={lead.company} />}
                        <div className="stack" style={{ minWidth: 0 }}>
                          <span className="cell-text truncate">{lead.role ?? "—"}</span>
                          {lead.company && <span className="cell-text truncate">{lead.company}</span>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <p className="cell-msg">
                        <Preview lead={lead} />
                      </p>
                    </td>
                    <td>
                      <span className={`status-pill pill-${STATUS_TONE[lead.status]}`}>{STATUS_LABEL[lead.status]}</span>
                      {lead.followUpsSent > 0 && (lead.status === "WAITING_REPLY" || lead.status === "CONVERSATION_OPEN") && (
                        <span className="cell-sub" style={{ display: "block", marginTop: 4 }}>
                          Follow-up {lead.followUpsSent}/{followUpMax}
                        </span>
                      )}
                    </td>
                    <td>
                      <FitCell score={lead.icpScore} />
                    </td>
                    <td>
                      <RowMenu lead={lead} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Celular: cartões */}
          <ul className="only-mobile lead-cards">
            {mobileItems.map((lead, i) => {
              const unread = lead.lastMessage?.sender === "LEAD";
              return (
                <li key={lead.id} className="rise" style={{ "--i": i } as React.CSSProperties}>
                  <Link href={`/leads/${lead.id}`} className={`lead-card${lead.status === "NEEDS_HUMAN" ? " urgent" : ""}`}>
                    <Avatar firstName={lead.firstName} lastName={lead.lastName} size={62} status={STATUS_TONE[lead.status]} />
                    <div className="lead-card-main">
                      <div className="lead-card-top">
                        <span className="lead-card-name">{fullName(lead)}</span>
                        <span className="lead-card-time">{lead.when}</span>
                      </div>
                      {lead.jobTitle && (
                        <div className="lead-card-role">
                          {lead.role}
                          {lead.company && (
                            <>
                              <br />
                              na {lead.company}
                            </>
                          )}
                        </div>
                      )}
                      <div className="lead-card-preview">
                        <Preview lead={lead} />
                      </div>
                    </div>
                    {unread && (
                      <span className="unread-badge" aria-label="Mensagem nova">
                        1
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="pager">
            <span className="small faint">
              Mostrando {pageItems.length} de {visible.length} lead{visible.length !== 1 ? "s" : ""}
            </span>
            {pages > 1 && (
              <nav className="pager-pages" aria-label="Páginas">
                <button
                  type="button"
                  className="pager-btn"
                  onClick={() => setPage(current - 1)}
                  disabled={current === 1}
                  aria-label="Página anterior"
                >
                  <IconChevronLeft size={16} />
                </button>
                {pageNumbers(current, pages).map((p, i) =>
                  p === "…" ? (
                    <span key={`gap-${i}`} className="pager-gap">
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      className="pager-btn"
                      aria-current={p === current ? "page" : undefined}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  className="pager-btn"
                  onClick={() => setPage(current + 1)}
                  disabled={current === pages}
                  aria-label="Próxima página"
                >
                  <IconChevronRight size={16} />
                </button>
              </nav>
            )}
          </div>
        </>
      )}
    </section>
  );
}
