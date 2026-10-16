"use client";

import { useState } from "react";

// Voz do assistente: vozes prontas ou a sua voz gravada. As duas ficam montadas para não perder o que estava aberto.
export function VoiceTabs({ ready, mine, initial }: { ready: React.ReactNode; mine: React.ReactNode; initial: "ready" | "mine" }) {
  const [tab, setTab] = useState(initial);
  return (
    <section id="voz" className="panel" aria-labelledby="h-voz" style={{ scrollMarginTop: 24 }}>
      <div className="panel-top">
        <h2 className="panel-h" id="h-voz" style={{ margin: 0 }}>
          Voz do assistente
        </h2>
        <div className="seg" role="tablist" aria-label="Tipo de voz">
          <button type="button" role="tab" className="tab2" aria-selected={tab === "ready"} onClick={() => setTab("ready")}>
            Vozes prontas
          </button>
          <button type="button" role="tab" className="tab2" aria-selected={tab === "mine"} onClick={() => setTab("mine")}>
            Minha voz
          </button>
        </div>
      </div>
      <div hidden={tab !== "ready"}>{ready}</div>
      <div hidden={tab !== "mine"}>{mine}</div>
    </section>
  );
}
