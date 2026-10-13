"use client";

import { useState } from "react";
import { TagInput } from "@/components/TagInput";
import { EMPTY_SEARCH, buildLinkedinSearchUrl, hasAnyFilter, type PeopleSearchFilters } from "@/lib/linkedin";

type ListKey = Exclude<keyof PeopleSearchFilters, "onlyNotConnected">;

// Filtros disponíveis, na ordem em que aparecem. Cargo e cidade vêm abertos;
// o resto o corretor adiciona só se precisar.
const FIELDS: {
  key: ListKey;
  label: string;
  placeholder: string;
  hint?: string;
  suggestions: string[];
  summary: (v: string) => string;
}[] = [
  {
    key: "titles",
    label: "Cargo",
    placeholder: "Ex.: Diretor de RH",
    suggestions: ["Diretor de RH", "Sócio", "CFO", "Diretor financeiro", "Gerente administrativo", "Proprietário"],
    summary: (v) => `com cargo ${v}`,
  },
  {
    key: "locations",
    label: "Cidade ou região",
    placeholder: "Ex.: Porto Alegre",
    suggestions: ["Porto Alegre", "São Paulo", "Curitiba", "Florianópolis", "Belo Horizonte"],
    summary: (v) => `em ${v}`,
  },
  {
    key: "companies",
    label: "Empresa atual",
    placeholder: "Ex.: nome da empresa",
    suggestions: [],
    summary: (v) => `trabalhando em ${v}`,
  },
  {
    key: "industries",
    label: "Setor",
    placeholder: "Ex.: Tecnologia",
    suggestions: ["Tecnologia", "Saúde", "Advocacia", "Construção", "Logística", "Varejo"],
    summary: (v) => `do setor ${v}`,
  },
  {
    key: "keywords",
    label: "Palavra-chave",
    placeholder: "Qualquer termo do perfil",
    suggestions: [],
    summary: (v) => `com ${v} no perfil`,
  },
  { key: "firstNames", label: "Nome", placeholder: "Primeiro nome", suggestions: [], summary: (v) => `chamadas ${v}` },
  { key: "lastNames", label: "Sobrenome", placeholder: "Sobrenome", suggestions: [], summary: (v) => `de sobrenome ${v}` },
  {
    key: "schools",
    label: "Escola ou faculdade",
    placeholder: "Ex.: PUCRS",
    suggestions: [],
    summary: (v) => `que estudaram em ${v}`,
  },
];

// "a", "a ou b", "a, b ou c"
function joinOr(values: string[]) {
  const quoted = values.map((v) => `“${v}”`);
  return quoted.length <= 1 ? quoted.join("") : `${quoted.slice(0, -1).join(", ")} ou ${quoted[quoted.length - 1]}`;
}

// initialKeywords: público da campanha (cargos/setores/empresas) já entra como palavra-chave.
// onSearch: com a busca pelo Google ligada, o botão principal busca aqui mesmo
// e "Abrir no LinkedIn" vira alternativa.
export function PeopleSearchBuilder({
  initialKeywords = [],
  initialFilters,
  onSearch,
  searching = false,
}: {
  initialKeywords?: string[];
  // Busca recente escolhida: já abre com esses filtros preenchidos.
  initialFilters?: PeopleSearchFilters;
  onSearch?: (filters: PeopleSearchFilters) => void;
  searching?: boolean;
}) {
  const [filters, setFilters] = useState<PeopleSearchFilters>(initialFilters ?? { ...EMPTY_SEARCH, keywords: initialKeywords });
  const [visible, setVisible] = useState<ListKey[]>(() => {
    const base: ListKey[] = ["titles", "locations"];
    const filled = FIELDS.map((f) => f.key).filter((k) => (initialFilters ?? { ...EMPTY_SEARCH, keywords: initialKeywords })[k].length > 0);
    return [...base, ...filled.filter((k) => !base.includes(k))];
  });

  const hidden = FIELDS.filter((f) => !visible.includes(f.key));
  const active = FIELDS.filter((f) => filters[f.key].length > 0);
  const ready = hasAnyFilter(filters);

  function set(key: ListKey, values: string[]) {
    setFilters((prev) => ({ ...prev, [key]: values }));
  }

  function removeField(key: ListKey) {
    set(key, []);
    setVisible((prev) => prev.filter((k) => k !== key));
  }

  const summary = ready
    ? `Pessoas ${active.map((f) => f.summary(joinOr(filters[f.key]))).join(", ")}${filters.onlyNotConnected ? ", que ainda não são suas conexões" : ""}.`
    : "Preencha pelo menos um filtro.";

  return (
    <div className="stack" style={{ gap: 14 }}>
      {FIELDS.filter((f) => visible.includes(f.key)).map((f) => (
        <div key={f.key}>
          <div className="sec-head">
            <label className="label">{f.label}</label>
            {!(f.key === "titles" && visible.length === 1) && (
              <button type="button" className="btn-text tiny" onClick={() => removeField(f.key)} aria-label={`Remover filtro ${f.label}`}>
                Remover
              </button>
            )}
          </div>
          <TagInput label={f.label} values={filters[f.key]} onChange={(v) => set(f.key, v)} placeholder={f.placeholder} suggestions={f.suggestions} />
          {f.hint && filters[f.key].length > 0 && <p className="hint">{f.hint}</p>}
        </div>
      ))}

      {hidden.length > 0 && (
        <div className="stack" style={{ gap: 8 }}>
          <span className="label" style={{ margin: 0 }}>Adicionar filtro</span>
          <div className="row wrap" style={{ gap: 6 }}>
            {hidden.map((f) => (
              <button key={f.key} type="button" className="pill" style={{ border: 0, cursor: "pointer" }} onClick={() => setVisible((prev) => [...prev, f.key])}>
                + {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {!onSearch && (
        <div className="setting" style={{ padding: 0 }}>
          <span className="setting-text">
            <b>Só quem ainda não é conexão</b>
            <small>Conexões não podem receber convite</small>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={filters.onlyNotConnected}
            aria-label="Só quem ainda não é conexão"
            className="switch"
            onClick={() => setFilters((prev) => ({ ...prev, onlyNotConnected: !prev.onlyNotConnected }))}
          />
        </div>
      )}

      <div aria-live="polite" className="note">
        <span className="label">Você vai buscar</span>
        <p>{onSearch && ready ? summary.replace(", que ainda não são suas conexões", "") : summary}</p>
        {ready && (
          <span className="hint">
            {onSearch
              ? "A busca procura esses termos nos perfis públicos do LinkedIn (cargo, empresa, cidade)."
              : "O LinkedIn procura esses termos no perfil inteiro (cargo, empresa, resumo). Confira os resultados antes de copiar os links."}
          </span>
        )}
      </div>

      {onSearch && (
        <div className="stack" style={{ gap: 8, alignItems: "flex-start" }}>
          <button type="button" className="btn-solid btn-block" disabled={!ready || searching} onClick={() => onSearch(filters)}>
            {searching ? "Buscando…" : "Buscar pessoas"}
          </button>
          {ready && (
            <a href={buildLinkedinSearchUrl(filters)} target="_blank" rel="noopener noreferrer" className="btn-text">
              ou abrir a mesma busca no LinkedIn
            </a>
          )}
        </div>
      )}

      {!onSearch && (
        <div className="row" style={{ gap: 8 }}>
          {ready && (
            <button
              type="button"
              className="btn-line"
              onClick={() => {
                setFilters(EMPTY_SEARCH);
                setVisible(["titles", "locations"]);
              }}
            >
              Limpar
            </button>
          )}
          <a
            href={ready ? buildLinkedinSearchUrl(filters) : undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!ready}
            className="btn-solid grow"
          >
            Buscar no LinkedIn
          </a>
        </div>
      )}
    </div>
  );
}
