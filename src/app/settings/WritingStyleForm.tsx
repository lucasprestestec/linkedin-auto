"use client";

import { useState } from "react";
import { MAX_RULES, MAX_RULE_CHARS, MAX_SAMPLES, MAX_SAMPLE_CHARS, parseWritingStyle, ruleWarnings, type WritingStyle } from "@/lib/writingStyle";
import { updateWritingStyle } from "./style-actions";
import { Field, FieldsCard } from "./FieldsCard";

// Uma regra por linha; um exemplo por bloco (separados por uma linha em branco).
const toRules = (t: string) => t.split("\n");
const toSamples = (t: string) => t.split(/\n\s*\n/);

// Edição à mão (avançado): ajustes escritos por extenso e mensagens coladas. O resto do perfil
// (perguntas, escolhas, respostas) é mexido pela calibragem e pelos ajustes rápidos.
export function WritingStyleForm({ value }: { value: WritingStyle }) {
  const [rulesText, setRulesText] = useState(value.rules.join("\n"));
  const [samplesText, setSamplesText] = useState(value.samples.join("\n\n"));

  const edited = parseWritingStyle({ rules: toRules(rulesText), samples: toSamples(samplesText) });
  const serialized = JSON.stringify({ rules: edited.rules, samples: edited.samples });
  const initial = JSON.stringify({ rules: value.rules, samples: value.samples });
  const tooLong = toSamples(samplesText).filter((s) => s.trim().length > MAX_SAMPLE_CHARS).length;

  return (
    <FieldsCard action={updateWritingStyle} name="writingStyle" serialized={serialized} initial={initial}>
      <Field label="Ajustes" hint={`Um por linha, até ${MAX_RULES}. Ex.: Nunca começo com "Prezado". Me despeço com "Abraço".`}>
        <textarea
          className="field"
          rows={4}
          value={rulesText}
          onChange={(e) => setRulesText(e.target.value)}
          aria-label="Ajustes"
          placeholder={'Nunca começo com "Prezado"\nMe despeço com "Abraço"'}
        />
        <p className="hint" style={{ margin: "4px 0 0" }}>
          {edited.rules.length} de {MAX_RULES} · até {MAX_RULE_CHARS} caracteres cada
        </p>
        {ruleWarnings(edited.rules).map((w) => (
          <p key={w.rule} className="field-error" role="status" style={{ margin: "4px 0 0" }}>
            &ldquo;{w.rule}&rdquo;: {w.why}
          </p>
        ))}
      </Field>
      <Field
        label="Mensagens que eu já escrevi"
        hint={`Cole mensagens reais suas, separadas por uma linha em branco. Até ${MAX_SAMPLES}. Tire nomes e dados de clientes antes de colar.`}
      >
        <textarea
          className="field"
          rows={6}
          value={samplesText}
          onChange={(e) => setSamplesText(e.target.value)}
          aria-label="Mensagens que eu já escrevi"
          placeholder={"Oi, Marcos! Vi que você cuida do RH. Hoje vocês já têm plano de saúde pro time?\n\nBom dia! Passando pra saber se deu pra ver a minha mensagem. Sem pressa."}
        />
        <p className="hint" style={{ margin: "4px 0 0" }}>
          {edited.samples.length} de {MAX_SAMPLES} exemplos
          {tooLong > 0 && ` · ${tooLong} passa${tooLong > 1 ? "m" : ""} de ${MAX_SAMPLE_CHARS} caracteres e será cortado${tooLong > 1 ? "s" : ""}`}
        </p>
      </Field>
    </FieldsCard>
  );
}
