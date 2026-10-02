"use client";

import { CHANNELS, type ChannelKey } from "@/components/ChannelBadge";
import { ApprovalCard, type ApprovalItem } from "@/app/approvals/ApprovalCard";
import { useChannel } from "./ChannelContext";

// Rascunhos do assistente desta pessoa, para aprovar sem sair da conversa. Só aparecem os do canal aberto;
// se há rascunho em outro canal, um aviso leva até ele.
export function ChannelDrafts({ items }: { items: ApprovalItem[] }) {
  const { channel, setChannel } = useChannel();
  if (items.length === 0) return null;
  const here = items.filter((d) => d.channelKey === channel);
  const elsewhere = [...new Set(items.filter((d) => d.channelKey !== channel).map((d) => d.channelKey))] as ChannelKey[];
  return (
    <div className="ap-inline">
      {here.map((d) => (
        <ApprovalCard key={d.id} item={d} compact />
      ))}
      {elsewhere.map((c) => (
        <button key={c} type="button" className="ap-elsewhere" onClick={() => setChannel(c)}>
          Há um rascunho para {CHANNELS[c].label}. Ver
        </button>
      ))}
    </div>
  );
}
