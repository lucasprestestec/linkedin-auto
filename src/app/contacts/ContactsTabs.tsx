"use client";

import { useState } from "react";

// Os jeitos de colocar gente nova, um por aba. Todas ficam montadas para não perder o que foi digitado ao trocar.
export const CONTACT_TABS = [
  { key: "buscar", label: "Buscar no LinkedIn" },
  { key: "quentes", label: "Sugestões quentes" },
  { key: "colar", label: "Colar perfis" },
  { key: "mao", label: "Adicionar à mão" },
  { key: "planilha", label: "Importar planilha" },
] as const;
export type ContactTabKey = (typeof CONTACT_TABS)[number]["key"];

export function ContactsTabs({ initial, panes }: { initial: ContactTabKey; panes: Record<ContactTabKey, React.ReactNode> }) {
  const [tab, setTab] = useState<ContactTabKey>(initial);

  return (
    <section className="add" aria-label="Colocar gente nova">
      <div className="tabs-line add-tabs" role="tablist" aria-label="Como colocar gente nova">
        {CONTACT_TABS.map((t) => (
          <button key={t.key} type="button" role="tab" id={`ct-${t.key}`} aria-controls={`cp-${t.key}`} aria-selected={tab === t.key} className="tab2" onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      {CONTACT_TABS.map((t) => (
        <div key={t.key} role="tabpanel" id={`cp-${t.key}`} aria-labelledby={`ct-${t.key}`} hidden={tab !== t.key} className="add-body">
          {panes[t.key]}
        </div>
      ))}
    </section>
  );
}
