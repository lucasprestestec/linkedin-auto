import { IconLinkedin, IconMail, IconWhatsapp } from "./Icons";

export type ChannelKey = "LINKEDIN" | "EMAIL" | "WHATSAPP";

// Nome e ícone de cada canal. As cores moram no CSS (variáveis --ch-*), num lugar só.
export const CHANNELS: Record<ChannelKey, { label: string; Icon: typeof IconLinkedin }> = {
  LINKEDIN: { label: "LinkedIn", Icon: IconLinkedin },
  EMAIL: { label: "E-mail", Icon: IconMail },
  WHATSAPP: { label: "WhatsApp", Icon: IconWhatsapp },
};

// Selo quadrado com o ícone do canal.
export function ChannelBadge({ channel, size = 28 }: { channel: ChannelKey; size?: number }) {
  const c = CHANNELS[channel];
  return (
    <span className={`ch-badge ch-c-${channel.toLowerCase()}`} style={{ width: size, height: size }} title={c.label}>
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
