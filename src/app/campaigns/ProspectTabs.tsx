"use client";

import { useState } from "react";

type Tab = "warm" | "search";

// Dois jeitos de achar gente: buscar por cargo/cidade/empresa ou
// convidar quem já te notou (visitou o perfil / te segue). As duas abas ficam
// montadas para não perder o que foi digitado ao trocar.
export function ProspectTabs({ warm, search }: { warm: React.ReactNode; search: React.ReactNode }) {
  const [tab, setTab] = useState<Tab>("search");

  return (
    <div id="prospect-tabs" className="stack" style={{ gap: 16, scrollMarginTop: 16 }}>
      <div className="tabs" role="tablist" aria-label="Como encontrar pessoas">
        <button type="button" role="tab" id="tab-search" aria-controls="panel-search" aria-selected={tab === "search"} onClick={() => setTab("search")}>
          Buscar pessoas
        </button>
        <button type="button" role="tab" id="tab-warm" aria-controls="panel-warm" aria-selected={tab === "warm"} onClick={() => setTab("warm")}>
          Quem já te notou
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
