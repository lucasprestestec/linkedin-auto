import type { MessageChannel } from "@prisma/client";

type Prefs = { preferredChannel: MessageChannel | null; blockedChannels: MessageChannel[] };

export const CHANNEL_NAME: Record<MessageChannel, string> = { LINKEDIN: "LinkedIn", EMAIL: "E-mail", WHATSAPP: "WhatsApp" };

// Canais que a pessoa pediu para não receber (ex.: "não me chame no WhatsApp"). Vale para o que o assistente
// começa sozinho; responder a quem escreveu por aquele canal continua permitido.
export const isBlocked = (lead: Pick<Prefs, "blockedChannels">, channel: MessageChannel) => lead.blockedChannels.includes(channel);

// Dos canais disponíveis agora: tira os bloqueados e, havendo preferência disponível, fica só com ela.
// Preferência indisponível (limite do dia, e-mail devolvido...) não trava: segue com os outros.
export function usableChannels(lead: Prefs, options: MessageChannel[]): MessageChannel[] {
  const allowed = options.filter((c) => !isBlocked(lead, c));
  return lead.preferredChannel && allowed.includes(lead.preferredChannel) ? [lead.preferredChannel] : allowed;
}
