"use client";

import { createContext, useContext, useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { InviteState } from "./actions";

export type CampaignOption = { id: string; name: string; description: string | null };

// O que as listas de Prospectar precisam saber para convidar: campanhas ativas,
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
  // Chamado depois do sucesso, para a lista tirar quem já foi convidado.
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
      if (!r || r.error) return setError(r?.error ?? "Não foi possível convidar.");
      setDone({ scheduled: r.scheduled, skippedForLimit: r.skippedForLimit, campaignName: campaigns.find((c) => c.id === campaignId)?.name ?? null });
    });
  }

  const overLimit = count > invitesLeft;

  // Portal: dentro dos blocos (overflow/transform) o painel fixo ficaria cortado.
  return createPortal(
    <div className="sheet-backdrop" onClick={() => !pending && close()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="invite-sheet-title" onClick={(e) => e.stopPropagation()}>
        {done ? (
          <div className="stack" style={{ gap: 14 }}>
            <h2 id="invite-sheet-title" className="t-label">
              {done.scheduled} convite{done.scheduled !== 1 ? "s" : ""} agendado{done.scheduled !== 1 ? "s" : ""}
            </h2>
            <p className="muted">
              {done.campaignName ? (
                <>
                  Na campanha <b>{done.campaignName}</b>.{" "}
                </>
              ) : null}
              Os convites saem ao longo do dia. Quem aceitar recebe a primeira mensagem do assistente e aparece em Conversas.
            </p>
            {done.skippedForLimit > 0 && <p className="note note-warn">{done.skippedForLimit} ficaram de fora pelo limite de hoje.</p>}
            <div className="row wrap" style={{ gap: 8 }}>
              <button type="button" className="btn-solid" onClick={close}>
                Continuar prospectando
              </button>
              <Link href="/" className="btn-line">
                Ver o Início
              </Link>
            </div>
          </div>
        ) : (
          <div className="stack" style={{ gap: 16 }}>
            <div className="sec-head">
              <h2 id="invite-sheet-title" className="t-label">
                Convidar {count} pessoa{count !== 1 ? "s" : ""}
              </h2>
              <button type="button" className="btn-text" onClick={close} disabled={pending}>
                Fechar
              </button>
            </div>

            <p className="muted">Em qual campanha? O assistente usa a oferta da campanha na conversa.</p>
            <div className="stack" style={{ gap: 8 }} role="radiogroup" aria-label="Campanha">
              <CampaignChoice checked={campaignId === ""} onSelect={() => setCampaignId("")} title="Sem campanha" sub="Usa a sua abordagem padrão" />
              {campaigns.map((c) => (
                <CampaignChoice key={c.id} checked={campaignId === c.id} onSelect={() => setCampaignId(c.id)} title={c.name} sub={c.description} />
              ))}
            </div>
            {campaigns.length === 0 && (
              <p className="hint">
                Quer separar por oferta? <Link href="/campaigns/new" className="btn-text">Crie uma campanha</Link>. É opcional.
              </p>
            )}

            <p className={overLimit ? "note note-warn" : "hint"}>
              {invitesLeft <= 0
                ? "O limite de convites de hoje já foi atingido. Tente amanhã."
                : overLimit
                  ? `Hoje cabem mais ${invitesLeft}. Os outros ${count - invitesLeft} ficam de fora.`
                  : `Hoje ainda cabem ${invitesLeft} convites.`}
            </p>

            {error && <p className="field-error">{error}</p>}

            <button type="button" className="btn-solid btn-block" onClick={confirm} disabled={pending || invitesLeft <= 0}>
              {pending ? "Agendando convites…" : "Confirmar convites"}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function CampaignChoice({ checked, onSelect, title, sub }: { checked: boolean; onSelect: () => void; title: string; sub: string | null }) {
  return (
    <button type="button" role="radio" aria-checked={checked} className="choice-row" onClick={onSelect}>
      <span className="setting-text">
        <b>{title}</b>
        {sub && <small className="truncate">{sub}</small>}
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
      <span>
        <b>{count}</b> selecionada{count !== 1 ? "s" : ""}
      </span>
      <button type="button" className="btn-solid btn-sm" onClick={onContinue}>
        {label}
      </button>
    </div>
  );
}
