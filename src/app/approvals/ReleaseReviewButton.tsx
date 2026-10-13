"use client";

import { useTransition } from "react";
import { releaseCampaignReview } from "./actions";

export function ReleaseReviewButton({ campaignId, name }: { campaignId: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="btn-line btn-sm"
      disabled={pending}
      onClick={() => {
        if (window.confirm(`Liberar "${name}" antes do prazo? As mensagens dela passam a seguir a aprovação geral.`)) start(() => releaseCampaignReview(campaignId));
      }}
    >
      {pending ? "Liberando…" : "Liberar"}
    </button>
  );
}
