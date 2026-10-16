"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CampaignStatus as Status } from "@prisma/client";
import type { CampaignNumbers } from "@/lib/campaignStats";
import { CampaignStatus } from "@/components/CampaignStatus";
import { IconSearch } from "@/components/Icons";
import { CampaignMenu } from "./CampaignMenu";

export interface CampaignRow {
  id: string;
  name: string;
  description: string | null;
  status: Status;
  createdTs: number;
  since: string;
  numbers: CampaignNumbers;
}

const TABS: { key: "all" | Status; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "ACTIVE", label: "Ativas" },
  { key: "PAUSED", label: "Pausadas" },
  { key: "FINISHED", label: "Finalizadas" },
];

// Lista de campanhas: uma linha por campanha, com os três números que importam e o "Abrir".
export function CampaignsView({ campaigns }: { campaigns: CampaignRow[] }) {
  const [tab, setTab] = useState<"all" | Status>("all");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = campaigns.filter((c) => (tab === "all" || c.status === tab) && (!q || `${c.name} ${c.description ?? ""}`.toLowerCase().includes(q)));
    return [...list].sort((a, b) => b.createdTs - a.createdTs);
  }, [campaigns, tab, query]);

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row wrap" style={{ gap: 10 }}>
        <label className="srch" style={{ margin: 0, flex: "1 1 260px" }}>
          <IconSearch size={18} />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar campanha" aria-label="Buscar campanha" />
        </label>
        <div className="filters" role="group" aria-label="Filtrar campanhas" style={{ padding: 0 }}>
          {TABS.map((t) => (
            <button key={t.key} type="button" className="chip" aria-pressed={tab === t.key} onClick={() => setTab(t.key)}>
              {t.label} · {t.key === "all" ? campaigns.length : campaigns.filter((c) => c.status === t.key).length}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="empty">Nenhuma campanha aqui.</p>
      ) : (
        <ul className="camps">
          {visible.map((c) => (
            <li key={c.id} className={`camp${c.status === "ACTIVE" ? "" : " is-off"}`}>
              <div className="camp-main">
                <h2 className="camp-name">
                  <Link href={`/campaigns/${c.id}`}>{c.name}</Link> <CampaignStatus status={c.status} />
                </h2>
                {c.description && <p className="camp-desc">{c.description}</p>}
                <p className="cap-note">desde {c.since}</p>
              </div>
              <dl className="camp-nums">
                <div>
                  <dt>Pessoas</dt>
                  <dd>{c.numbers.leads}</dd>
                </div>
                <div>
                  <dt>Responderam</dt>
                  <dd>{c.numbers.replied}</dd>
                </div>
                <div>
                  <dt>Reuniões</dt>
                  <dd>{c.numbers.meetings}</dd>
                </div>
              </dl>
              <div className="row-act">
                <Link href={`/campaigns/${c.id}`} className="btn-line btn-sm">
                  Abrir
                </Link>
                <CampaignMenu id={c.id} name={c.name} status={c.status} leads={c.numbers.leads} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="cap-note">Campanha é opcional: quem você adiciona sem campanha conversa com a oferta padrão do assistente.</p>
    </div>
  );
}
