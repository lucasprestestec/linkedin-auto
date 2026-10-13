import type { CampaignStatus as Status } from "@prisma/client";
import { CAMPAIGN_STATUS_LABEL } from "@/lib/campaignStats";

const TONE: Record<Status, string> = { ACTIVE: "pill-ok", PAUSED: "pill-warn", FINISHED: "" };

export function CampaignStatus({ status }: { status: Status }) {
  return <span className={`pill ${TONE[status]}`}>{CAMPAIGN_STATUS_LABEL[status]}</span>;
}
