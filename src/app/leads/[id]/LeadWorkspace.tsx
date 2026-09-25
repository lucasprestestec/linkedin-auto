"use client";

import { createContext, useContext, useState } from "react";
import { IconUser, IconX } from "@/components/Icons";

// Computador: o painel de detalhes do lead (status, etiquetas, anotações...)
// fica fechado por padrão e abre pelo botão "Detalhes" no topo do chat.
const DetailsContext = createContext<{ open: boolean; toggle: () => void }>({ open: false, toggle: () => {} });

export function LeadWorkspace({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <DetailsContext.Provider value={{ open, toggle: () => setOpen((o) => !o) }}>
      <div className={`lead-layout${open ? " details-open" : ""}`}>{children}</div>
    </DetailsContext.Provider>
  );
}

export function DetailsToggle() {
  const { open, toggle } = useContext(DetailsContext);
  return (
    <button type="button" className="btn btn-secondary btn-sm only-desktop details-btn" aria-expanded={open} onClick={toggle}>
      {open ? <IconX size={15} /> : <IconUser size={15} />} {open ? "Fechar" : "Detalhes"}
    </button>
  );
}
