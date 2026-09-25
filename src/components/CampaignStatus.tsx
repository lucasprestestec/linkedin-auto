import type { CampaignStatus as Status } from "@prisma/client";
import { CAMPAIGN_STATUS_CLASS, CAMPAIGN_STATUS_LABEL } from "@/lib/campaignStats";

export function CampaignStatus({ status }: { status: Status }) {
  return (
    <span className={`camp-status ${CAMPAIGN_STATUS_CLASS[status]}`}>
      <i /> {CAMPAIGN_STATUS_LABEL[status]}
    </span>
  );
}
