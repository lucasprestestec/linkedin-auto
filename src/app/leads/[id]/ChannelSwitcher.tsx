"use client";

import { CHANNELS, ChannelBadge, type ChannelKey } from "@/components/ChannelBadge";
import { useChannel } from "./ChannelContext";

// Seletor de canal: um botão por canal, com o ícone, o nome e quantas mensagens há ali.
export function ChannelSwitcher({ counts, drafts }: { counts: Record<ChannelKey, number>; drafts: Record<ChannelKey, number> }) {
  const { channel, setChannel, available } = useChannel();
  return (
    <div className="ch-switch" role="tablist" aria-label="Canal da conversa">
      {available.map((c) => (
        <button key={c} type="button" role="tab" aria-selected={channel === c} className={`ch-tab ch-${c.toLowerCase()}`} onClick={() => setChannel(c)}>
          <ChannelBadge channel={c} size={22} />
          <span>{CHANNELS[c].label}</span>
          {counts[c] > 0 && <span className="count">{counts[c]}</span>}
          {drafts[c] > 0 && <i className="ch-draft" title="Rascunho esperando sua aprovação" />}
        </button>
      ))}
    </div>
  );
}
