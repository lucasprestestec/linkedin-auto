"use client";

import { useState } from "react";
import { COMPANY_SIZES, parseIdealClient, serializeIdealClient, type IdealClient } from "@/lib/audience";
import { TagInput } from "@/components/TagInput";
import { IconBan, IconBriefcase, IconBuilding, IconFactory, IconMail, IconMapPin, IconTarget } from "@/components/Icons";
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
      title="Quem você quer alcançar"
      subtitle="A IA usa isso pra sugerir pessoas e dizer quem combina mais com você"
      icon={<IconTarget size={19} />}
      iconStyle={{ background: "var(--success-soft)", color: "var(--success-ink)" }}
      status={serialized ? "Preencha só o que importa — campos vazios são ignorados" : "Sem descrição — as sugestões vêm sem nota"}
    >
      <Field icon={<IconBriefcase size={15} />} label="Cargos">
        <TagInput
          label="Cargos"
          values={icp.titles}
          onChange={(v) => set("titles", v)}
          placeholder="Ex.: Diretor de RH"
          suggestions={["Sócio", "Diretor de RH", "Diretor financeiro", "CFO", "Gerente administrativo", "Proprietário"]}
        />
      </Field>
      <Field icon={<IconFactory size={15} />} label="Setores">
        <TagInput
          label="Setores"
          values={icp.industries}
          onChange={(v) => set("industries", v)}
          placeholder="Ex.: Tecnologia"
          suggestions={["Tecnologia", "Saúde", "Advocacia", "Construção", "Indústria", "Varejo"]}
        />
      </Field>
      <Field icon={<IconBuilding size={15} />} label="Tamanho da empresa (funcionários)">
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }} role="group" aria-label="Tamanho da empresa">
          {COMPANY_SIZES.map((size) => (
            <button key={size} type="button" className="chip" style={{ height: 34 }} aria-pressed={icp.sizes.includes(size)} onClick={() => toggleSize(size)}>
              {size}
            </button>
          ))}
        </div>
      </Field>
      <Field icon={<IconMapPin size={15} />} label="Região">
        <TagInput
          label="Região"
          values={icp.regions}
          onChange={(v) => set("regions", v)}
          placeholder="Ex.: Porto Alegre"
          suggestions={["Rio Grande do Sul", "Santa Catarina", "Paraná", "São Paulo"]}
        />
      </Field>
      <Field icon={<IconBan size={15} />} label="Evitar" hint="Perfis assim ficam no fim da fila. Pra bloquear de vez, use &ldquo;Quem nunca contatar&rdquo;.">
        <TagInput
          label="Evitar"
          values={icp.avoid}
          onChange={(v) => set("avoid", v)}
          placeholder="Ex.: Estudante"
          suggestions={["Estudante", "Corretor de seguros", "Recrutador", "Estagiário"]}
        />
      </Field>
      <Field icon={<IconMail size={15} />} label="Observações">
        <textarea
          className="textarea"
          value={icp.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={3}
          aria-label="Observações"
          placeholder="Qualquer detalhe a mais. Ex.: empresas que ainda não têm plano de saúde."
          style={{ fontSize: 14.5, resize: "vertical" }}
        />
      </Field>
    </FieldsCard>
  );
}
