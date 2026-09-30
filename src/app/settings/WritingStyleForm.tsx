"use client";

import { useState } from "react";
import {
  MAX_RULES,
  MAX_RULE_CHARS,
  MAX_SAMPLES,
  MAX_SAMPLE_CHARS,
  parseWritingStyle,
  ruleWarnings,
  type EmojiLevel,
  type LengthPref,
  type Treatment,
  type WritingStyle,
} from "@/lib/writingStyle";
import { updateWritingStyle } from "./style-actions";
import { Field, FieldsCard } from "./FieldsCard";

// Uma regra por linha; um exemplo por bloco (separados por uma linha em branco).
const toRules = (t: string) => t.split("\n");
const toSamples = (t: string) => t.split(/\n\s*\n/);

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; text: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="tabs" role="group" aria-label={label} style={{ flexWrap: "wrap" }}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.text}
        </button>
      ))}
    </div>
  );
}

// "Meu jeito de escrever": como o corretor fala. Entra no assistente como um bloco à parte;
// as regras fixas (não inventar, não se passar por pessoa) continuam valendo acima dele.
export function WritingStyleForm({ value }: { value: WritingStyle }) {
  const [treatment, setTreatment] = useState<Treatment>(value.treatment);
  const [emoji, setEmoji] = useState<EmojiLevel>(value.emoji);
  const [length, setLength] = useState<LengthPref>(value.length);
  const [rulesText, setRulesText] = useState(value.rules.join("\n"));
  const [samplesText, setSamplesText] = useState(value.samples.join("\n\n"));

  const style = parseWritingStyle({ treatment, emoji, length, rules: toRules(rulesText), samples: toSamples(samplesText), dismissed: value.dismissed });
  const serialized = JSON.stringify(style);
  const initial = JSON.stringify(parseWritingStyle(value));
  const tooLong = toSamples(samplesText).filter((s) => s.trim().length > MAX_SAMPLE_CHARS).length;

  return (
    <FieldsCard action={updateWritingStyle} name="writingStyle" serialized={serialized} initial={initial}>
      <Field label="Como você chama as pessoas">
        <Choice
          label="Tratamento"
          value={treatment}
          onChange={setTreatment}
          options={[
            { value: "auto", text: "Tanto faz" },
            { value: "voce", text: "Você" },
            { value: "senhor", text: "Senhor(a)" },
          ]}
        />
      </Field>
      <Field label="Emojis">
        <Choice
          label="Emojis"
          value={emoji}
          onChange={setEmoji}
          options={[
            { value: "auto", text: "Tanto faz" },
            { value: "never", text: "Nunca" },
            { value: "few", text: "Raramente" },
          ]}
        />
      </Field>
      <Field label="Tamanho das mensagens">
        <Choice
          label="Tamanho"
          value={length}
          onChange={setLength}
          options={[
            { value: "auto", text: "Tanto faz" },
            { value: "short", text: "Bem curtas" },
          ]}
        />
      </Field>
      <Field label="Regras do meu jeito" hint={`Uma por linha, até ${MAX_RULES}. Ex.: Nunca começo com "Prezado". Sempre me despeço com "Abraço". Não uso "reunião", digo "conversa rápida".`}>
        <textarea
          className="field"
          rows={4}
          value={rulesText}
          onChange={(e) => setRulesText(e.target.value)}
          aria-label="Regras do meu jeito"
          placeholder={'Nunca começo com "Prezado"\nMe despeço com "Abraço"'}
        />
        <p className="hint" style={{ margin: "4px 0 0" }}>
          {style.rules.length} de {MAX_RULES} regras · até {MAX_RULE_CHARS} caracteres cada
        </p>
        {ruleWarnings(style.rules).map((w) => (
          <p key={w.rule} className="field-error" role="status" style={{ margin: "4px 0 0" }}>
            &ldquo;{w.rule}&rdquo;: {w.why}
          </p>
        ))}
      </Field>
      <Field
        label="Mensagens que eu já escrevi"
        hint={`Cole mensagens reais suas (de WhatsApp, LinkedIn ou e-mail), separadas por uma linha em branco. Até ${MAX_SAMPLES}. O assistente aprende o seu ritmo e o seu vocabulário, sem copiar as frases. Tire nomes e dados de clientes antes de colar.`}
      >
        <textarea
          className="field"
          rows={8}
          value={samplesText}
          onChange={(e) => setSamplesText(e.target.value)}
          aria-label="Mensagens que eu já escrevi"
          placeholder={"Oi, Marcos! Vi que você cuida do RH da empresa. Hoje vocês já oferecem plano de saúde pro time?\n\nBom dia! Passando pra saber se deu pra ver a minha mensagem. Sem pressa."}
        />
        <p className="hint" style={{ margin: "4px 0 0" }}>
          {style.samples.length} de {MAX_SAMPLES} exemplos
          {tooLong > 0 && ` · ${tooLong} passa${tooLong > 1 ? "m" : ""} de ${MAX_SAMPLE_CHARS} caracteres e será cortado${tooLong > 1 ? "s" : ""}`}
        </p>
      </Field>
    </FieldsCard>
  );
}
