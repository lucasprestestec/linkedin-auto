"use client";

import { createContext, useContext, useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { InviteState } from "./actions";
import { IconAlert, IconArrowRight, IconCheck, IconMegaphone, IconShield, IconUserPlus, IconX } from "@/components/Icons";

export type CampaignOption = { id: string; name: string; description: string | null };

// O que as listas de Prospectar precisam saber pra convidar: campanhas ativas,
// a campanha que veio no link (?campaign=) e quantos convites ainda cabem hoje.
type ProspectInfo = { campaigns: CampaignOption[]; defaultCampaignId: string; invitesLeft: number };

const ProspectContext = createContext<ProspectInfo>({ campaigns: [], defaultCampaignId: "", invitesLeft: 0 });

export function ProspectProvider({ value, children }: { value: ProspectInfo; children: React.ReactNode }) {
  return <ProspectContext.Provider value={value}>{children}</ProspectContext.Provider>;
}

export function useProspectInfo() {
  return useContext(ProspectContext);
}

type Done = { scheduled: number; skippedForLimit: number; campaignName: string | null };

// Último passo de qualquer lista (busca, quem já te notou, links colados):
// a pessoa já marcou quem quer; aqui só escolhe a campanha e confirma.
export function InviteSheet({
  count,
  onInvite,
  onClose,
  onDone,
}: {
  count: number;
  onInvite: (campaignId?: string) => Promise<InviteState>;
  onClose: () => void;
  // Chamado depois do sucesso, pra lista tirar quem já foi convidado.
  onDone: () => void;
}) {
  const { campaigns, defaultCampaignId, invitesLeft } = useProspectInfo();
  const [campaignId, setCampaignId] = useState(campaigns.some((c) => c.id === defaultCampaignId) ? defaultCampaignId : "");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) close();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  });

  function close() {
    if (done) onDone();
    onClose();
  }

  function confirm() {
    setError(null);
    start(async () => {
      const r = await onInvite(campaignId || undefined);
      if (!r || r.error) return setError(r?.error ?? "Falha ao convidar.");
      setDone({ scheduled: r.scheduled, skippedForLimit: r.skippedForLimit, campaignName: campaigns.find((c) => c.id === campaignId)?.name ?? null });
    });
  }

  const overLimit = count > invitesLeft;

  // Portal: dentro dos cards (overflow/transform) o painel fixo ficaria cortado.
  return createPortal(
    <div className="sheet-backdrop invite-backdrop" onClick={() => !pending && close()}>
      <div className="sheet invite-sheet" role="dialog" aria-modal="true" aria-labelledby="invite-sheet-title" onClick={(e) => e.stopPropagation()}>
        {done ? (
          <div className="invite-done">
            <span className="success-icon">
              <IconCheck size={30} strokeWidth={3} />
            </span>
            <h2 id="invite-sheet-title" className="title-lg">
              {done.scheduled} convite{done.scheduled !== 1 ? "s" : ""} agendado{done.scheduled !== 1 ? "s" : ""}
            </h2>
            <p className="small muted" style={{ maxWidth: 320 }}>
              {done.campaignName ? (
                <>
                  Na campanha <b>{done.campaignName}</b>.{" "}
                </>
              ) : null}
              Os convites saem ao longo do dia. Quem aceitar recebe a primeira mensagem da IA e aparece em Conversas.
            </p>
            {done.skippedForLimit > 0 && (
              <span className="badge badge-invite">
                {done.skippedForLimit} ficaram de fora pelo limite de hoje
              </span>
            )}
            <div className="invite-done-actions">
              <Link href="/" className="btn btn-secondary btn-block">
                Acompanhar resultados <IconArrowRight size={16} />
              </Link>
              <button type="button" className="btn btn-primary btn-block" onClick={close}>
                Continuar prospectando
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="sheet-head">
              <h2 id="invite-sheet-title" className="title-md">
                Convidar {count} pessoa{count !== 1 ? "s" : ""}
              </h2>
              <button type="button" className="icon-btn" aria-label="Fechar" onClick={close} disabled={pending}>
                <IconX size={20} />
              </button>
            </div>

            <div className="invite-body">
              <p className="small muted">Em qual campanha? A IA usa a oferta da campanha na conversa.</p>
              <div className="camp-options" role="radiogroup" aria-label="Campanha">
                <CampaignChoice checked={campaignId === ""} onSelect={() => setCampaignId("")} title="Sem campanha" sub="A IA usa sua abordagem padrão" />
                {campaigns.map((c) => (
                  <CampaignChoice key={c.id} checked={campaignId === c.id} onSelect={() => setCampaignId(c.id)} title={c.name} sub={c.description} campaign />
                ))}
              </div>
              {campaigns.length === 0 && (
                <p className="hint">
                  Quer separar por oferta? <Link href="/campaigns/new" style={{ color: "var(--brand-ink)", fontWeight: 700 }}>Crie uma campanha</Link> — é opcional.
                </p>
              )}

              <p className={`quota-note${overLimit ? " warn" : ""}`}>
                <IconShield size={14} />
                {invitesLeft <= 0
                  ? "O limite de convites de hoje já foi atingido — tente amanhã."
                  : overLimit
                    ? `Hoje cabem mais ${invitesLeft}. Os outros ${count - invitesLeft} ficam de fora.`
                    : `Hoje ainda cabem ${invitesLeft} convites.`}
              </p>

              {error && (
                <p className="error-text">
                  <IconAlert size={15} /> {error}
                </p>
              )}
            </div>

            <button type="button" className="btn btn-primary btn-lg btn-block" onClick={confirm} disabled={pending || invitesLeft <= 0}>
              {pending ? (
                <>
                  <span className="spinner" /> Agendando convites…
                </>
              ) : (
                <>
                  <IconUserPlus size={19} /> Confirmar convites
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

function CampaignChoice({
  checked,
  onSelect,
  title,
  sub,
  campaign,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  sub: string | null;
  campaign?: boolean;
}) {
  return (
    <button type="button" role="radio" aria-checked={checked} className="camp-option" onClick={onSelect}>
      <span className={`camp-option-icon${campaign ? " is-camp" : ""}`}>{campaign ? <IconMegaphone size={17} /> : <IconUserPlus size={17} />}</span>
      <span className="stack" style={{ gap: 1, minWidth: 0, flex: 1, textAlign: "left" }}>
        <b>{title}</b>
        {sub && <span className="tiny faint camp-option-sub">{sub}</span>}
      </span>
      <span className="radio-dot" aria-hidden />
    </button>
  );
}

// Barra fixa no rodapé das listas: aparece quando há alguém marcado.
export function SelectionBar({ count, onContinue, label = "Continuar" }: { count: number; onContinue: () => void; label?: string }) {
  if (count === 0) return null;
  return (
    <div className="selection-bar" role="region" aria-label="Pessoas selecionadas">
      <span className="selection-count">
        <b>{count}</b> selecionada{count !== 1 ? "s" : ""}
      </span>
      <button type="button" className="btn btn-primary" onClick={onContinue}>
        {label} <IconArrowRight size={16} />
      </button>
    </div>
  );
}
