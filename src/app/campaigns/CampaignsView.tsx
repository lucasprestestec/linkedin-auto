"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CampaignStatus as Status } from "@prisma/client";
import type { CampaignNumbers } from "@/lib/campaignStats";
import { CampaignStatus } from "@/components/CampaignStatus";
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

const rate = (n: CampaignNumbers) => (n.rate === null ? "sem respostas" : `${n.rate}% responderam`);

export function CampaignsView({ campaigns }: { campaigns: CampaignRow[] }) {
  const [tab, setTab] = useState<"all" | Status>("all");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = campaigns.filter((c) => (tab === "all" || c.status === tab) && (!q || `${c.name} ${c.description ?? ""}`.toLowerCase().includes(q)));
    return [...list].sort((a, b) => b.createdTs - a.createdTs);
  }, [campaigns, tab, query]);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <input className="search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar campanha" aria-label="Buscar campanha" />

      <div className="tabs" role="toolbar" aria-label="Filtrar campanhas">
        {TABS.map((t) => (
          <button key={t.key} type="button" aria-pressed={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}
            <span className="count">{t.key === "all" ? campaigns.length : campaigns.filter((c) => c.status === t.key).length}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="empty card">Nenhuma campanha aqui.</p>
      ) : (
        <ul className="list card card-flush">
          {visible.map((c) => (
            <li key={c.id}>
              <div className="item">
                <Link href={`/campaigns/${c.id}`} className="item-main" style={{ textDecoration: "none" }}>
                  <span className="item-title">{c.name}</span>
                  <span className="item-sub">
                    {c.numbers.leads} {c.numbers.leads === 1 ? "pessoa" : "pessoas"} · {rate(c.numbers)} · {c.numbers.qualified}{" "}
                    {c.numbers.qualified === 1 ? "oportunidade" : "oportunidades"}
                  </span>
                </Link>
                <CampaignStatus status={c.status} />
                <CampaignMenu id={c.id} name={c.name} status={c.status} leads={c.numbers.leads} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
