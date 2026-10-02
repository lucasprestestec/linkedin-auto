"use client";

import type { ChannelKey } from "@/components/ChannelBadge";
import { useChannel } from "./ChannelContext";

// Mostra o conteúdo só quando o canal aberto na conversa é este (ex.: o aviso "agora é com você" só no canal que o causou).
export function OnChannel({ channel, children }: { channel: ChannelKey; children: React.ReactNode }) {
  return useChannel().channel === channel ? <>{children}</> : null;
}
