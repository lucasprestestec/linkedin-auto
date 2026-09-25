"use client";

import { useState } from "react";
import { parseExclusionLines, serializeExclusionLines, type ExclusionLists } from "@/lib/audience";
import { linkedinProfileSlug } from "@/lib/linkedin";
import { TagInput } from "@/components/TagInput";
import { IconBan, IconBuilding, IconLink, IconUser } from "@/components/Icons";
import { updateExclusionList } from "./actions";
import { Field, FieldsCard } from "./FieldsCard";

// Lista de exclusão separada por tipo — cada tipo casa de um jeito diferente
// (ver src/lib/exclusion.ts).
export function ExclusionListForm({ value }: { value: string }) {
  const [lists, setLists] = useState<ExclusionLists>(() => parseExclusionLines(value));
  const [badLink, setBadLink] = useState(false);
  const serialized = serializeExclusionLines(lists);
  const initial = serializeExclusionLines(parseExclusionLines(value));
  const set = (key: keyof ExclusionLists, v: string[]) => setLists((prev) => ({ ...prev, [key]: v }));
  const total = lists.companies.length + lists.people.length + lists.profiles.length + lists.other.length;

  return (
    <FieldsCard
      action={updateExclusionList}
      name="exclusionList"
      serialized={serialized}
      initial={initial}
      title="Nunca contatar"
      subtitle="Clientes atuais, concorrentes, colegas…"
      icon={<IconBan size={19} />}
      iconStyle={{ background: "var(--urgent-soft)", color: "var(--urgent-ink)" }}
      status={total ? `${total} ite${total > 1 ? "ns" : "m"} — ficam fora de convites, sugestões e mensagens da IA` : "Lista vazia"}
    >
      <Field icon={<IconBuilding size={15} />} label="Empresas" hint="Bloqueia quem tem o nome da empresa no cargo do LinkedIn.">
        <TagInput label="Empresas" values={lists.companies} onChange={(v) => set("companies", v)} placeholder="Ex.: Porto Seguro" max={200} />
      </Field>
      <Field icon={<IconUser size={15} />} label="Pessoas" hint="Nome completo, como aparece no LinkedIn.">
        <TagInput label="Pessoas" values={lists.people} onChange={(v) => set("people", v)} placeholder="Ex.: Maria Souza" max={200} />
      </Field>
      <Field icon={<IconLink size={15} />} label="Perfis (links)" hint={badLink ? "Isso não parece um link de perfil — use o campo Pessoas ou Empresas." : undefined}>
        <TagInput
          label="Perfis"
          values={lists.profiles}
          onChange={(v) => {
            const ok = v.filter((url) => linkedinProfileSlug(url));
            setBadLink(ok.length < v.length);
            set("profiles", ok);
          }}
          placeholder="https://www.linkedin.com/in/…"
          max={200}
        />
      </Field>
      {lists.other.length > 0 && (
        <Field icon={<IconBan size={15} />} label="Outros (nome ou empresa)" hint="Vale tanto pra nome quanto pra empresa.">
          <TagInput label="Outros" values={lists.other} onChange={(v) => set("other", v)} placeholder="Nome ou empresa" max={200} />
        </Field>
      )}
    </FieldsCard>
  );
}
