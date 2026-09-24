// Atalhos do topo da Prospecção (busca rápida, perfis sugeridos, card escuro)
// falam com as abas e com o montador de busca por um evento de janela — os
// componentes ficam independentes, sem estado compartilhado.
export interface ProspectGoDetail {
  target: "builder" | "paste" | "warm";
  title?: string;
}

export const PROSPECT_GO = "prospect:go";

export function goProspect(detail: ProspectGoDetail) {
  window.dispatchEvent(new CustomEvent<ProspectGoDetail>(PROSPECT_GO, { detail }));
}
