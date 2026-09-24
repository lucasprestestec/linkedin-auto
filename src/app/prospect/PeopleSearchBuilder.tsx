"use client";

import { useEffect, useState } from "react";
import { PROSPECT_GO, type ProspectGoDetail } from "./prospectEvents";
import { TagInput } from "@/components/TagInput";
import {
  IconBriefcase,
  IconBuilding,
  IconExternal,
  IconFactory,
  IconGraduation,
  IconHash,
  IconLinkedin,
  IconMapPin,
  IconPlus,
  IconUser,
  IconX,
} from "@/components/Icons";
import { EMPTY_SEARCH, buildLinkedinSearchUrl, hasAnyFilter, type PeopleSearchFilters } from "@/lib/linkedin";

type ListKey = Exclude<keyof PeopleSearchFilters, "onlyNotConnected">;

// Filtros disponíveis, na ordem em que aparecem. Cargo e cidade vêm abertos;
// o resto o corretor adiciona só se precisar.
const FIELDS: {
  key: ListKey;
  label: string;
  placeholder: string;
  hint?: string;
  Icon: (p: { size?: number }) => React.ReactElement;
  suggestions: string[];
  summary: (v: string) => string;
}[] = [
  {
    key: "titles",
    label: "Cargo",
    placeholder: "Ex.: Diretor de RH",
    Icon: IconBriefcase,
    suggestions: ["Diretor de RH", "Sócio", "CFO", "Diretor financeiro", "Gerente administrativo", "Proprietário"],
    summary: (v) => `com cargo ${v}`,
  },
  {
    key: "locations",
    label: "Cidade ou região",
    placeholder: "Ex.: Porto Alegre",
    Icon: IconMapPin,
    suggestions: ["Porto Alegre", "São Paulo", "Curitiba", "Florianópolis", "Belo Horizonte"],
    summary: (v) => `em ${v}`,
  },
  {
    key: "companies",
    label: "Empresa atual",
    placeholder: "Ex.: nome da empresa",
    Icon: IconBuilding,
    suggestions: [],
    summary: (v) => `trabalhando em ${v}`,
  },
  {
    key: "industries",
    label: "Setor",
    placeholder: "Ex.: Tecnologia",
    Icon: IconFactory,
    suggestions: ["Tecnologia", "Saúde", "Advocacia", "Construção", "Logística", "Varejo"],
    summary: (v) => `do setor ${v}`,
  },
  {
    key: "keywords",
    label: "Palavra-chave",
    placeholder: "Qualquer termo do perfil",
    Icon: IconHash,
    suggestions: [],
    summary: (v) => `com ${v} no perfil`,
  },
  { key: "firstNames", label: "Nome", placeholder: "Primeiro nome", Icon: IconUser, suggestions: [], summary: (v) => `chamadas ${v}` },
  { key: "lastNames", label: "Sobrenome", placeholder: "Sobrenome", Icon: IconUser, suggestions: [], summary: (v) => `de sobrenome ${v}` },
  {
    key: "schools",
    label: "Escola ou faculdade",
    placeholder: "Ex.: PUCRS",
    Icon: IconGraduation,
    suggestions: [],
    summary: (v) => `que estudaram em ${v}`,
  },
];

// "a", "a ou b", "a, b ou c"
function joinOr(values: string[]) {
  const quoted = values.map((v) => `“${v}”`);
  return quoted.length <= 1 ? quoted.join("") : `${quoted.slice(0, -1).join(", ")} ou ${quoted[quoted.length - 1]}`;
}

export function PeopleSearchBuilder() {
  const [filters, setFilters] = useState<PeopleSearchFilters>(EMPTY_SEARCH);
  const [visible, setVisible] = useState<ListKey[]>(["titles", "locations"]);

  // Busca rápida / perfil sugerido do topo da página entra como cargo.
  useEffect(() => {
    function onGo(e: Event) {
      const title = (e as CustomEvent<ProspectGoDetail>).detail.title?.trim();
      if (!title) return;
      setFilters((prev) =>
        prev.titles.some((t) => t.toLowerCase() === title.toLowerCase()) ? prev : { ...prev, titles: [...prev.titles, title] },
      );
      setVisible((prev) => (prev.includes("titles") ? prev : ["titles", ...prev]));
    }
    window.addEventListener(PROSPECT_GO, onGo);
    return () => window.removeEventListener(PROSPECT_GO, onGo);
  }, []);

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
        <div key={f.key} className="filter-field">
          <div className="filter-field-head">
            <span className="filter-field-label">
              <f.Icon size={15} /> {f.label}
            </span>
            {!(f.key === "titles" && visible.length === 1) && (
              <button type="button" className="filter-remove" onClick={() => removeField(f.key)} aria-label={`Remover filtro ${f.label}`}>
                <IconX size={14} />
              </button>
            )}
          </div>
          <TagInput label={f.label} values={filters[f.key]} onChange={(v) => set(f.key, v)} placeholder={f.placeholder} suggestions={f.suggestions} />
          {f.hint && filters[f.key].length > 0 && <p className="hint">{f.hint}</p>}
        </div>
      ))}

      {hidden.length > 0 && (
        <div className="stack" style={{ gap: 8 }}>
          <span className="label">Adicionar filtro</span>
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            {hidden.map((f) => (
              <button key={f.key} type="button" className="chip" style={{ height: 34 }} onClick={() => setVisible((prev) => [...prev, f.key])}>
                <IconPlus size={13} /> {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="setting-row filter-toggle">
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontWeight: 700 }}>Só quem ainda não é conexão</span>
          <span className="tiny faint">Conexões não podem receber convite</span>
        </span>
        <input
          type="checkbox"
          className="sr-only"
          checked={filters.onlyNotConnected}
          onChange={(e) => setFilters((prev) => ({ ...prev, onlyNotConnected: e.target.checked }))}
        />
        <span className="switch switch-light" role="switch" aria-checked={filters.onlyNotConnected} aria-hidden="true" />
      </label>

      <div className="search-summary" aria-live="polite">
        <span className="label">Você vai buscar</span>
        <p>{summary}</p>
        {ready && <span className="tiny muted">O LinkedIn procura esses termos no perfil inteiro (cargo, empresa, resumo). Confira os resultados antes de copiar os links.</span>}
      </div>

      <div className="row" style={{ gap: 8 }}>
        {ready && (
          <button
            type="button"
            className="btn btn-secondary"
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
          className="btn btn-dark"
          style={{ flex: 1 }}
        >
          <IconLinkedin size={18} />
          Buscar no LinkedIn
          <IconExternal size={16} style={{ opacity: 0.6 }} />
        </a>
      </div>
    </div>
  );
}
