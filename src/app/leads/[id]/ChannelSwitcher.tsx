"use client";

import { CHANNELS, ChannelBadge, type ChannelKey } from "@/components/ChannelBadge";
import { useChannel } from "./ChannelContext";

// Seletor de canal: um botão por canal, com o ícone, o nome e quantas mensagens há ali.
// Segue o padrão de abas: só a aba aberta recebe o Tab, as setas trocam de canal e a conversa é o painel da aba.
export function ChannelSwitcher({ counts, drafts }: { counts: Record<ChannelKey, number>; drafts: Record<ChannelKey, number> }) {
  const { channel, setChannel, available } = useChannel();

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    const last = available.length - 1;
    const next = e.key === "ArrowRight" ? (index === last ? 0 : index + 1) : e.key === "ArrowLeft" ? (index === 0 ? last : index - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : -1;
    if (next < 0) return;
    e.preventDefault();
    setChannel(available[next]);
    document.getElementById(`tab-${available[next]}`)?.focus();
  }

  return (
    <div className="ch-switch" role="tablist" aria-label="Canal da conversa">
      {available.map((c, i) => (
        <button
          key={c}
          id={`tab-${c}`}
          type="button"
          role="tab"
          aria-selected={channel === c}
          aria-controls="thread-panel"
          tabIndex={channel === c ? 0 : -1}
          className={`ch-tab ch-${c.toLowerCase()}`}
          onClick={() => setChannel(c)}
          onKeyDown={(e) => onKeyDown(e, i)}
        >
          <ChannelBadge channel={c} size={22} />
          <span>{CHANNELS[c].label}</span>
          {counts[c] > 0 && (
            <span className="count">
              {counts[c]}
              <span className="sr-only"> mensagens</span>
            </span>
          )}
          {drafts[c] > 0 && (
            <>
              <i className="ch-draft" aria-hidden="true" />
              <span className="sr-only">, rascunho esperando sua aprovação</span>
            </>
          )}
        </button>
      ))}
    </div>
  );
}
