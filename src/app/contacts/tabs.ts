// Os jeitos de colocar gente nova, um por aba. Fica fora do componente de abas (que roda no navegador)
// porque a página, no servidor, também precisa da lista para abrir a aba pedida em ?aba=.
export const CONTACT_TABS = [
  { key: "buscar", label: "Buscar no LinkedIn" },
  { key: "quentes", label: "Sugestões quentes" },
  { key: "colar", label: "Colar perfis" },
  { key: "mao", label: "Adicionar à mão" },
  { key: "planilha", label: "Importar planilha" },
] as const;
export type ContactTabKey = (typeof CONTACT_TABS)[number]["key"];
