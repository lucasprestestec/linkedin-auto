import { MAX_RULE_CHARS, ruleWarnings, type RuleWarning } from "@/lib/writingStyle";

// "Sugerir mudanças": o corretor escreve do jeito dele ("tá muito formal", "as frases estão grandes")
// e isto vira ajustes claros pro assistente. Sem IA (funciona mesmo sem saldo no provedor), e a tela
// sempre mostra o que foi entendido. O que não reconhecemos entra como pedido dele, com as palavras dele.

interface Pattern {
  id: string;
  rule: string;
  test: (t: string) => boolean;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const PATTERNS: Pattern[] = [
  {
    id: "shorter",
    rule: "Escreva mensagens mais curtas: no máximo 2 frases.",
    test: (t) =>
      (/\b(grande|grandes|longo|longa|longos|longas|comprid\w*|cansativ\w*|prolix\w*)\b/.test(t) && /(frase|mensagem|texto|resposta|msg)/.test(t)) ||
      /muito (texto|longo|comprido)|textao|textoes/.test(t),
  },
  {
    id: "longer",
    rule: "Escreva mensagens um pouco mais completas, com duas ou três frases.",
    test: (t) => /(curt\w+ demais|muito curt\w+|mais completa\w*|mais detalh\w+|falta detalhe)/.test(t),
  },
  {
    id: "less_formal",
    rule: "Escreva de forma mais informal e direta, sem fórmulas de cortesia.",
    test: (t) => !/informal/.test(t) && /(formal|rebuscad\w+|protocolar|engessad\w+|pomposo\w*|duro\b|dura\b)/.test(t),
  },
  {
    id: "more_formal",
    rule: "Escreva de forma um pouco mais cuidadosa e profissional, sem gírias.",
    test: (t) => /(informal demais|muito informal|giria\w*|intimo demais|intimidade demais|desrespeit\w+)/.test(t),
  },
  {
    id: "more_emoji",
    rule: "Pode usar emojis com moderação, no máximo 1 por mensagem.",
    test: (t) => /emoji|carinha/.test(t) && /(mais emoji|use mais|coloque mais|pode usar|gosto de emoji|falta emoji|usa pouco)/.test(t),
  },
  {
    id: "no_emoji",
    rule: "Não use emojis.",
    test: (t) =>
      /emoji|carinha|figurinha/.test(t) &&
      !/(mais emoji|use mais|coloque mais|pode usar|gosto de emoji|falta emoji|usa pouco)/.test(t) &&
      /(tira|tirar|sem|nao use|nunca|para de|parar|menos|demais|muito|muitos|excess\w*|exager\w*|chega)/.test(t),
  },
  {
    id: "natural",
    rule: "Soe natural, como uma pessoa conversando: evite frases prontas, aberturas genéricas e linguagem de folheto; varie a forma de começar.",
    test: (t) => /(robo|robotic\w*|automatic\w*|artificial|generic\w*|template|mecanic\w*|copia e cola|cliche|propaganda|folheto|padronizad\w*|decorad\w*|frases? pronta\w*)/.test(t),
  },
  {
    id: "repeat",
    rule: "Não repita frases, aberturas ou perguntas já usadas na conversa.",
    test: (t) => /repet\w+|sempre (a )?mesm\w+|mesma abertura/.test(t),
  },
  {
    id: "questions",
    rule: "Faça uma pergunta só por mensagem.",
    test: (t) => /pergunta/.test(t) && /(muita|muitas|demais|excess\w*|varias|mais de uma|bombard\w*|interrog\w*)/.test(t),
  },
  {
    id: "pushy",
    rule: "Não pressione nem insista: se a pessoa hesitar, ofereça ajuda em vez de empurrar.",
    test: (t) => /(insist\w*|pression\w*|empurr\w*|agressiv\w*|invasiv\w*|\bchato\b|vendedor demais|forcad\w*)/.test(t),
  },
  {
    id: "direct",
    rule: "Vá direto ao ponto já na primeira frase.",
    test: (t) => /(direto ao ponto|rodeio\w*|enrol\w*|demora pra chegar|vai direto|va direto)/.test(t),
  },
  {
    id: "warm",
    rule: "Seja mais caloroso e próximo: cumprimente e mostre interesse pela pessoa antes de ir ao assunto.",
    test: (t) => /(\bfri[oa]s?\b|distante|impessoal|\bsec[oa]s?\b|mais simpatic\w*|pouco simpatic\w*|acolhedor\w*|caloroso|mais proxim\w*)/.test(t),
  },
  {
    id: "no_flattery",
    rule: "Não faça elogios vazios nem exagerados.",
    test: (t) => /(elogio\w*|bajul\w*)/.test(t),
  },
];

export interface ChangeResult {
  // Ajustes novos que entram.
  added: string[];
  // Ajustes que já estavam aplicados.
  already: string[];
  // Pedidos que o assistente nunca vai seguir (as regras fixas vencem).
  blocked: RuleWarning[];
  // Avisos que não impedem (ex.: citou preço).
  notes: RuleWarning[];
  // Não reconhecemos o pedido e guardamos com as palavras dele.
  verbatim: boolean;
}

const sameRule = (a: string, b: string) => norm(a).replace(/\s+/g, " ").trim() === norm(b).replace(/\s+/g, " ").trim();

// `room`: quantos ajustes ainda cabem.
export function interpretChangeRequest(text: string, existing: string[], room: number): ChangeResult {
  const out: ChangeResult = { added: [], already: [], blocked: [], notes: [], verbatim: false };
  const original = text.replace(/\s+/g, " ").trim();
  if (!original) return out;
  const t = norm(original);

  let candidates = PATTERNS.filter((p) => p.test(t)).map((p) => p.rule);
  if (candidates.length === 0) {
    out.verbatim = true;
    const prefix = 'Pedido do corretor: "';
    candidates = [`${prefix}${original.slice(0, MAX_RULE_CHARS - prefix.length - 1)}"`];
    for (const w of ruleWarnings([original])) (w.kind === "price" ? out.notes : out.blocked).push(w);
    if (out.blocked.length) return out;
  }

  for (const rule of candidates) {
    if (existing.some((e) => sameRule(e, rule)) || out.added.some((a) => sameRule(a, rule))) out.already.push(rule);
    else if (out.added.length < room) out.added.push(rule);
  }
  return out;
}
