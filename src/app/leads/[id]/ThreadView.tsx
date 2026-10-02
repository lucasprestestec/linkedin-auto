"use client";

import { useEffect } from "react";
import { Avatar } from "@/components/Avatar";
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

const SENDER_LABEL = { AGENT: "Assistente", HUMAN: "Você" } as const;

function DaySep({ text, variant }: { text: string; variant: "wa" | "li" | "em" }) {
  return <div className={`day-sep day-${variant}`}>{text}</div>;
}

// A conversa do canal escolhido, no visual daquele app: WhatsApp (balões verdes), LinkedIn (lista com foto e nome)
// e e-mail (um cartão por mensagem). Só aparecem as mensagens do canal aberto.
export function ThreadView({ messages, leadFirst, leadLast, ownerName, children }: { messages: ThreadMessage[]; leadFirst: string | null; leadLast: string | null; ownerName: string; children?: React.ReactNode }) {
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

      {channel === "WHATSAPP" &&
        rows.map(({ m, showDay }) => (
          <div key={m.id} style={{ display: "contents" }}>
            {showDay && <DaySep text={m.dayText} variant="wa" />}
            <div className={`wa-msg ${m.sender === "LEAD" ? "in" : "out"}`}>
              <div className="wa-bubble">
                {m.sender === "AGENT" && <span className="wa-who">Assistente</span>}
                <span className="wa-text">{m.content}</span>
                <span className="wa-meta">
                  {m.time}
                  {m.sender !== "LEAD" && <IconCheckCheck size={14} />}
                </span>
              </div>
            </div>
          </div>
        ))}

      {channel === "LINKEDIN" &&
        rows.map(({ m, showDay }) => {
          const name = m.sender === "LEAD" ? leadName : m.sender === "AGENT" ? `${SENDER_LABEL.AGENT} de ${ownerName}` : ownerName;
          const [f, ...rest] = name.split(" ");
          return (
            <div key={m.id} style={{ display: "contents" }}>
              {showDay && <DaySep text={m.dayText} variant="li" />}
              <div className="li-msg">
                <Avatar firstName={f} lastName={rest.at(-1) ?? null} size={36} variant={m.sender === "AGENT" ? "assistant" : undefined} />
                <div className="li-body">
                  <div className="li-head">
                    <b>{name}</b>
                    <time>{m.time}</time>
                  </div>
                  <p>{m.content}</p>
                </div>
              </div>
            </div>
          );
        })}

      {channel === "EMAIL" &&
        rows.map(({ m, showDay }) => {
          const fromLead = m.sender === "LEAD";
          return (
            <div key={m.id} style={{ display: "contents" }}>
              {showDay && <DaySep text={m.dayText} variant="em" />}
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
