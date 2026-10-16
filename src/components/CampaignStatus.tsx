import type { CampaignStatus as Status } from "@prisma/client";
import { CAMPAIGN_STATUS_LABEL } from "@/lib/campaignStats";

const TONE: Record<Status, string> = { ACTIVE: "tg-ok", PAUSED: "tg-you", FINISHED: "tg-q" };

export function CampaignStatus({ status }: { status: Status }) {
  return <span className={`tg ${TONE[status]}`}>{CAMPAIGN_STATUS_LABEL[status]}</span>;
}
