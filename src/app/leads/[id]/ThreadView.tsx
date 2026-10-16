"use client";

import { useEffect } from "react";
import { CHANNELS, type ChannelKey } from "@/components/ChannelBadge";
import { IconCheckCheck } from "@/components/Icons";
import { useChannel } from "./ChannelContext";

// Mensagem já preparada no servidor (textos de data e hora prontos, para não divergir na hidratação).
export interface ThreadMessage {
  id: string;
  sender: "LEAD" | "AGENT" | "HUMAN";
  channel: ChannelKey;
  content: string;
  subject: string | null;
  // Só e-mail enviado com rastreio: null = sem rastreio.
  opened: { count: number } | null;
  time: string;
  dayKey: string;
  dayText: string;
}

function DaySep({ text }: { text: string }) {
  return <div className="day-sep">{text}</div>;
}

// A conversa do canal escolhido: balões (preto = você e o assistente, papel = a pessoa) no LinkedIn e no WhatsApp,
// e um cartão por mensagem no e-mail (que tem assunto). Só aparecem as mensagens do canal aberto.
export function ThreadView({ messages, leadFirst, leadLast, ownerName, children }: { messages: ThreadMessage[]; leadFirst: string | null; leadLast: string | null; leadPhoto?: string | null; ownerName: string; children?: React.ReactNode }) {
  const { channel } = useChannel();
  const items = messages.filter((m) => m.channel === channel);
  const leadName = [leadFirst, leadLast].filter(Boolean).join(" ") || "Contato";

  // Ao trocar de canal, abre na mensagem mais recente daquele canal.
  useEffect(() => {
    document.getElementById("thread-end")?.scrollIntoView({ block: "end" });
  }, [channel]);

  const rows = items.map((m, i) => ({ m, showDay: i === 0 || items[i - 1].dayKey !== m.dayKey }));

  return (
    <div id="thread-panel" role="tabpanel" aria-labelledby={`tab-${channel}`} className={`thread th th-${channel.toLowerCase()}`} data-channel={channel}>
      {items.length === 0 && (
        <p className="empty" style={{ textAlign: "center" }}>
          Nenhuma mensagem por {CHANNELS[channel].label} ainda.
        </p>
      )}

      {channel !== "EMAIL" &&
        rows.map(({ m, showDay }) => {
          const who = m.sender === "LEAD" ? (leadFirst ?? "Contato") : m.sender === "AGENT" ? "Assistente" : "Você";
          return (
            <div key={m.id} style={{ display: "contents" }}>
              {showDay && <DaySep text={m.dayText} />}
              <div className={`bub-row ${m.sender === "LEAD" ? "them" : "me"}`}>
                <div className="bub">{m.content}</div>
                <span className="bub-meta">
                  {who} · {m.time}
                  {m.sender !== "LEAD" && channel === "WHATSAPP" && <IconCheckCheck size={14} />}
                </span>
              </div>
            </div>
          );
        })}

      {channel === "EMAIL" &&
        rows.map(({ m, showDay }) => {
          const fromLead = m.sender === "LEAD";
          return (
            <div key={m.id} style={{ display: "contents" }}>
              {showDay && <DaySep text={m.dayText} />}
              <article className={`em-msg ${fromLead ? "in" : "out"}`}>
                <header>
                  <b>{m.subject || "(sem assunto)"}</b>
                  <time>{m.time}</time>
                </header>
                <div className="em-from">
                  {fromLead ? `${leadName} para ${ownerName}` : `${m.sender === "AGENT" ? `Assistente de ${ownerName}` : ownerName} para ${leadName}`}
                  {m.opened && <span className={`em-open${m.opened.count > 0 ? " seen" : ""}`}>{m.opened.count > 0 ? `aberto${m.opened.count > 1 ? ` ${m.opened.count}x` : ""}` : "não aberto"}</span>}
                </div>
                <div className="em-body">{m.content}</div>
              </article>
            </div>
          );
        })}

      {children}
      <div id="thread-end" />
    </div>
  );
}
