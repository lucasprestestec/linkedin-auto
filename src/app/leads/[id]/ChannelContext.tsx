"use client";

import { createContext, useContext, useState } from "react";
import type { ChannelKey } from "@/components/ChannelBadge";

// O canal que está aberto na conversa. O seletor, a conversa e o campo de resposta leem e mudam o mesmo valor.
interface Ctx {
  channel: ChannelKey;
  setChannel: (c: ChannelKey) => void;
  // Canais que aparecem no seletor (têm mensagens ou dá para enviar).
  available: ChannelKey[];
  // Canais por onde dá para enviar agora.
  reply: ChannelKey[];
}

const ChannelCtx = createContext<Ctx | null>(null);

export function ChannelProvider({ available, reply, initial, children }: { available: ChannelKey[]; reply: ChannelKey[]; initial: ChannelKey; children: React.ReactNode }) {
  const [channel, setChannel] = useState<ChannelKey>(available.includes(initial) ? initial : available[0]);
  return <ChannelCtx.Provider value={{ channel, setChannel, available, reply }}>{children}</ChannelCtx.Provider>;
}

export function useChannel(): Ctx {
  const ctx = useContext(ChannelCtx);
  if (!ctx) throw new Error("useChannel fora do ChannelProvider");
  return ctx;
}
