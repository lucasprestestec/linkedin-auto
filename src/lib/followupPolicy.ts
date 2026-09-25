// Qual regra de follow-up vale pra um lead: a da conversa (se o usuário
// personalizou), senão a da campanha, senão o padrão da conta.

export interface FollowUpRule {
  maxCount: number;
  delayHours: number;
  source: "lead" | "campaign" | "account";
}

type Override = { followUpMaxCount: number | null; followUpDelayHours: number | null };

export function followUpRuleFor(
  lead: Override,
  campaign: Override | null | undefined,
  account: { followUpMaxCount: number; followUpDelayHours: number },
): FollowUpRule {
  if (lead.followUpMaxCount != null && lead.followUpDelayHours != null) {
    return { maxCount: lead.followUpMaxCount, delayHours: lead.followUpDelayHours, source: "lead" };
  }
  if (campaign && campaign.followUpMaxCount != null && campaign.followUpDelayHours != null) {
    return { maxCount: campaign.followUpMaxCount, delayHours: campaign.followUpDelayHours, source: "campaign" };
  }
  return { maxCount: account.followUpMaxCount, delayHours: account.followUpDelayHours, source: "account" };
}

// "2 follow-ups a cada 3 dias" / "Sem follow-up"
export function describeRule(maxCount: number, delayHours: number): string {
  if (maxCount === 0) return "Sem follow-up";
  const days = Math.round(delayHours / 24);
  return `${maxCount} follow-up${maxCount > 1 ? "s" : ""} a cada ${days} dia${days > 1 ? "s" : ""}`;
}
