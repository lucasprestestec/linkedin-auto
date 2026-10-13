"use client";

import { useState } from "react";
import { COMPANY_SIZES, parseIdealClient, serializeIdealClient, type IdealClient } from "@/lib/audience";
import { TagInput } from "@/components/TagInput";
import { updateTargetAudience } from "./actions";
import { Field, FieldsCard } from "./FieldsCard";

// Cliente ideal em campos separados. Vira um texto rotulado ("Cargos: a; b")
// que a IA lê pra dar a nota de encaixe das sugestões.
export function IdealClientForm({ value }: { value: string }) {
  const [icp, setIcp] = useState<IdealClient>(() => parseIdealClient(value));
  const serialized = serializeIdealClient(icp);
  const initial = serializeIdealClient(parseIdealClient(value));
  const set = <K extends keyof IdealClient>(key: K, v: IdealClient[K]) => setIcp((prev) => ({ ...prev, [key]: v }));

  function toggleSize(size: string) {
    set("sizes", icp.sizes.includes(size) ? icp.sizes.filter((s) => s !== size) : COMPANY_SIZES.filter((s) => s === size || icp.sizes.includes(s)));
  }

  return (
    <FieldsCard
      action={updateTargetAudience}
      name="targetAudience"
      serialized={serialized}
      initial={initial}
      status={serialized ? "" : "Sem descrição, as sugestões vêm sem nota"}
    >
      <Field label="Cargos">
        <TagInput
          label="Cargos"
          values={icp.titles}
          onChange={(v) => set("titles", v)}
          placeholder="Ex.: Diretor de RH"
          suggestions={["Sócio", "Diretor de RH", "Diretor financeiro", "CFO", "Gerente administrativo", "Proprietário"]}
        />
      </Field>
      <Field label="Setores">
        <TagInput
          label="Setores"
          values={icp.industries}
          onChange={(v) => set("industries", v)}
          placeholder="Ex.: Tecnologia"
          suggestions={["Tecnologia", "Saúde", "Advocacia", "Construção", "Indústria", "Varejo"]}
        />
      </Field>
      <Field label="Tamanho da empresa (funcionários)">
        <div className="tabs" role="group" aria-label="Tamanho da empresa" style={{ flexWrap: "wrap" }}>
          {COMPANY_SIZES.map((size) => (
            <button key={size} type="button" aria-pressed={icp.sizes.includes(size)} onClick={() => toggleSize(size)}>
              {size}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Região">
        <TagInput
          label="Região"
          values={icp.regions}
          onChange={(v) => set("regions", v)}
          placeholder="Ex.: Porto Alegre"
          suggestions={["Rio Grande do Sul", "Santa Catarina", "Paraná", "São Paulo"]}
        />
      </Field>
      <Field label="Evitar" hint="Perfis assim ficam no fim da fila. Pra bloquear de vez, use &ldquo;Quem nunca contatar&rdquo;.">
        <TagInput
          label="Evitar"
          values={icp.avoid}
          onChange={(v) => set("avoid", v)}
          placeholder="Ex.: Estudante"
          suggestions={["Estudante", "Corretor de seguros", "Recrutador", "Estagiário"]}
        />
      </Field>
      <Field label="Observações">
        <textarea
          className="field"
          value={icp.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={3}
          aria-label="Observações"
          placeholder="Qualquer detalhe a mais. Ex.: empresas que ainda não têm plano de saúde."
         
        />
      </Field>
    </FieldsCard>
  );
}
