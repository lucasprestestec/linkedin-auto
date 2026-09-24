"use client";

import { useState, useTransition } from "react";
import { deleteCampaign, saveCampaign } from "./actions";
import { IconAlert, IconChevronRight, IconLayers, IconPlus } from "@/components/Icons";

export interface CampaignItem {
  id: string;
  name: string;
  instructions: string;
  leads: number;
}

function CampaignEditor({
  campaign,
  onDone,
  startOpen,
}: {
  campaign: CampaignItem | null;
  onDone?: () => void;
  startOpen?: boolean;
}) {
  const [name, setName] = useState(campaign?.name ?? "");
  const [instructions, setInstructions] = useState(campaign?.instructions ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = name !== (campaign?.name ?? "") || instructions !== (campaign?.instructions ?? "");

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveCampaign(campaign?.id ?? null, name, instructions);
      if (result.error) setError(result.error);
      else onDone?.();
    });
  }

  function remove() {
    if (!campaign) return onDone?.();
    if (!confirm(`Apagar a campanha "${campaign.name}"? Os ${campaign.leads} leads dela continuam, com as instruções gerais.`)) return;
    startTransition(async () => {
      await deleteCampaign(campaign.id);
    });
  }

  return (
    <details className="notice" open={startOpen} style={{ borderTop: "1px solid var(--border)" }}>
      <summary className="notice-summary" style={{ padding: "14px 16px" }}>
        <span className="stack" style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 700 }}>{campaign?.name || "Nova campanha"}</span>
          <span className="tiny faint">
            {campaign ? `${campaign.leads} lead${campaign.leads !== 1 ? "s" : ""}` : "Preencha e salve"}
            {campaign && !campaign.instructions && " · sem instruções (usa as gerais)"}
          </span>
        </span>
        <IconChevronRight size={18} className="chev notice-chev" />
      </summary>
      <div className="stack" style={{ gap: 10, padding: "0 16px 16px" }}>
        <input
          className="input"
          style={{ height: 44, fontSize: 15 }}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome (ex.: Saúde empresarial)"
          aria-label="Nome da campanha"
        />
        <textarea
          className="textarea"
          rows={5}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="O que o agente oferece para este público, objeções comuns, quando chamar você."
          aria-label="Instruções da campanha"
          style={{ fontSize: 14.5, resize: "vertical" }}
        />
        {error && (
          <p className="error-text">
            <IconAlert size={15} /> {error}
          </p>
        )}
        <div className="row" style={{ gap: 8, justifyContent: "space-between" }}>
          <button type="button" className="btn btn-ghost btn-sm" style={{ color: "var(--urgent-ink)" }} onClick={remove} disabled={pending}>
            {campaign ? "Apagar" : "Cancelar"}
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={pending || !dirty || !name.trim()}>
            {pending ? "Salvando…" : "Salvar campanha"}
          </button>
        </div>
      </div>
    </details>
  );
}

export function CampaignsForm({ campaigns }: { campaigns: CampaignItem[] }) {
  const [creating, setCreating] = useState(false);

  return (
    <div id="campanhas" className="card" style={{ overflow: "hidden", scrollMarginTop: 90 }}>
      <div className="setting-row">
        <span className="setting-icon" style={{ background: "var(--brand-soft)", color: "var(--brand-ink)" }}>
          <IconLayers size={19} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontWeight: 700 }}>Campanhas</span>
          <span className="tiny faint">Um público, um jeito de falar. Escolhida na hora de convidar.</span>
        </span>
        {!creating && (
          <button type="button" className="btn btn-soft btn-sm" onClick={() => setCreating(true)}>
            <IconPlus size={15} /> Nova
          </button>
        )}
      </div>
      {campaigns.map((c) => (
        <CampaignEditor key={`${c.id}-${c.name}-${c.instructions.length}`} campaign={c} />
      ))}
      {creating && <CampaignEditor campaign={null} startOpen onDone={() => setCreating(false)} />}
      {campaigns.length === 0 && !creating && (
        <div className="setting-row" style={{ background: "var(--surface-2)" }}>
          <p className="tiny muted" style={{ lineHeight: 1.5 }}>
            Sem campanhas, todo lead usa as instruções gerais do agente. Crie uma quando falar com públicos diferentes — ex.: &ldquo;Saúde
            empresarial&rdquo; e &ldquo;Seguro de vida para sócios&rdquo;.
          </p>
        </div>
      )}
    </div>
  );
}
