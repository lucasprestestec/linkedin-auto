"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CampaignStatus as Status } from "@prisma/client";
import type { CampaignNumbers } from "@/lib/campaignStats";
import { CampaignStatus } from "@/components/CampaignStatus";
import { IconChevronDown, IconChevronRight, IconMegaphone, IconSearch } from "@/components/Icons";
import { CampaignMenu } from "./CampaignMenu";

export interface CampaignRow {
  id: string;
  name: string;
  description: string | null;
  status: Status;
  createdTs: number;
  numbers: CampaignNumbers;
}

const TABS: { key: "all" | Status; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "ACTIVE", label: "Ativas" },
  { key: "PAUSED", label: "Pausadas" },
  { key: "FINISHED", label: "Finalizadas" },
];

const rate = (n: CampaignNumbers) => (n.rate === null ? "—" : `${n.rate}%`);

export function CampaignsView({ campaigns }: { campaigns: CampaignRow[] }) {
  const [tab, setTab] = useState<"all" | Status>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"recent" | "name" | "leads">("recent");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = campaigns.filter((c) => (tab === "all" || c.status === tab) && (!q || `${c.name} ${c.description ?? ""}`.toLowerCase().includes(q)));
    if (sort === "name") return [...list].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    if (sort === "leads") return [...list].sort((a, b) => b.numbers.leads - a.numbers.leads);
    return [...list].sort((a, b) => b.createdTs - a.createdTs);
  }, [campaigns, tab, query, sort]);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="chip-row" role="toolbar" aria-label="Filtrar campanhas">
        {TABS.map((t) => (
          <button key={t.key} type="button" className="chip" aria-pressed={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label} <span className="chip-count">{t.key === "all" ? campaigns.length : campaigns.filter((c) => c.status === t.key).length}</span>
          </button>
        ))}
      </div>

      <div className="row only-desktop-flex" style={{ gap: 10 }}>
        <label className="pill-input" style={{ maxWidth: 340 }}>
          <IconSearch size={17} />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar campanha..." aria-label="Buscar campanha" />
        </label>
        <label className="pill-select" style={{ display: "flex" }}>
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Ordenar">
            <option value="recent">Mais recentes</option>
            <option value="name">Nome (A–Z)</option>
            <option value="leads">Mais leads</option>
          </select>
          <IconChevronDown size={16} />
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="empty-line">Nenhuma campanha aqui.</p>
      ) : (
        <>
          <ul className="rows only-mobile">
            {visible.map((c) => (
              <li key={c.id}>
                <Link href={`/campaigns/${c.id}`} className="row-item">
                  <span className="camp-tile">
                    <IconMegaphone size={20} />
                  </span>
                  <span className="row-main">
                    <span className="row-top">
                      <span className="row-name">{c.name}</span>
                      <CampaignStatus status={c.status} />
                    </span>
                    {c.description && <span className="row-sub">{c.description}</span>}
                    <span className="mini-stats">
                      <span className="stack">
                        <b>{c.numbers.leads}</b>
                        <span>Leads</span>
                      </span>
                      <span className="stack">
                        <b>{rate(c.numbers)}</b>
                        <span>Resposta</span>
                      </span>
                      <span className="stack">
                        <b>{c.numbers.qualified}</b>
                        <span>Oportunidades</span>
                      </span>
                    </span>
                  </span>
                  <IconChevronRight size={16} className="faint" />
                </Link>
              </li>
            ))}
          </ul>

          <table className="simple-table camp-table only-desktop">
            <thead>
              <tr>
                <th>Campanha</th>
                <th>Leads</th>
                <th>Resposta</th>
                <th>Oportunidades</th>
                <th>Status</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/campaigns/${c.id}`} className="row" style={{ gap: 12 }}>
                      <span className="camp-tile" style={{ width: 38, height: 38, borderRadius: 11 }}>
                        <IconMegaphone size={17} />
                      </span>
                      <span className="stack" style={{ minWidth: 0 }}>
                        <b>{c.name}</b>
                        {c.description && <span className="tiny faint truncate">{c.description}</span>}
                      </span>
                    </Link>
                  </td>
                  <td>{c.numbers.leads}</td>
                  <td>{rate(c.numbers)}</td>
                  <td>{c.numbers.qualified}</td>
                  <td>
                    <CampaignStatus status={c.status} />
                  </td>
                  <td>
                    <CampaignMenu id={c.id} name={c.name} status={c.status} leads={c.numbers.leads} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
