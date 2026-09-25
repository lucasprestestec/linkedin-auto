"use client";

import { useState } from "react";
import { IconFlame, IconSearch } from "@/components/Icons";

type Tab = "warm" | "search";

// Dois jeitos de achar gente pra campanha: montar uma busca no LinkedIn ou
// convidar quem já te notou (visitou o perfil / te segue). As duas abas ficam
// montadas pra não perder o que foi digitado ao trocar.
export function ProspectTabs({ warm, search }: { warm: React.ReactNode; search: React.ReactNode }) {
  const [tab, setTab] = useState<Tab>("search");

  return (
    <div id="prospect-tabs" className="stack" style={{ gap: 16, scrollMarginTop: 16 }}>
      <div className="seg-tabs" role="tablist" aria-label="Como encontrar pessoas">
        <button type="button" role="tab" id="tab-search" aria-controls="panel-search" aria-selected={tab === "search"} onClick={() => setTab("search")}>
          <IconSearch size={16} />
          <span>
            <b>Buscar no LinkedIn</b>
            <small>Por cargo, cidade, empresa…</small>
          </span>
        </button>
        <button type="button" role="tab" id="tab-warm" aria-controls="panel-warm" aria-selected={tab === "warm"} onClick={() => setTab("warm")}>
          <IconFlame size={16} />
          <span>
            <b>Quem já te notou</b>
            <small>Visitou seu perfil ou te segue</small>
          </span>
        </button>
      </div>
      <div role="tabpanel" id="panel-search" aria-labelledby="tab-search" hidden={tab !== "search"} className="stack" style={{ gap: 16 }}>
        {search}
      </div>
      <div role="tabpanel" id="panel-warm" aria-labelledby="tab-warm" hidden={tab !== "warm"} className="stack" style={{ gap: 16 }}>
        {warm}
      </div>
    </div>
  );
}
