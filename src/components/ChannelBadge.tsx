import { IconLinkedin, IconMail, IconWhatsapp } from "./Icons";

export type ChannelKey = "LINKEDIN" | "EMAIL" | "WHATSAPP";

// Nome, ícone e cor de cada canal. As cores seguem a marca de cada app, em versão suave (fundo claro).
export const CHANNELS: Record<ChannelKey, { label: string; Icon: typeof IconLinkedin; color: string; soft: string }> = {
  LINKEDIN: { label: "LinkedIn", Icon: IconLinkedin, color: "#0a66c2", soft: "#e6f0fa" },
  EMAIL: { label: "E-mail", Icon: IconMail, color: "#d9453a", soft: "#fdeceb" },
  WHATSAPP: { label: "WhatsApp", Icon: IconWhatsapp, color: "#1a9e4a", soft: "#e4f6ea" },
};

// Selo quadrado com o ícone do canal.
export function ChannelBadge({ channel, size = 28 }: { channel: ChannelKey; size?: number }) {
  const c = CHANNELS[channel];
  return (
    <span className="ch-badge" style={{ width: size, height: size, color: c.color, background: c.soft }} title={c.label}>
      <c.Icon size={Math.round(size * 0.58)} />
    </span>
  );
}

// Título de seção com o selo do canal: "[ícone] LinkedIn".
export function ChannelTitle({ channel }: { channel: ChannelKey }) {
  return (
    <h2 className="t-label ch-title">
      <ChannelBadge channel={channel} />
      {CHANNELS[channel].label}
    </h2>
  );
}
