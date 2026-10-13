// Confere a Helena contra a Base de Conhecimento (Parte 22, testes T1 a T14), sem tocar no banco.
// Uso: npx tsx scripts/test-helena.ts <caminho-da-base.md> [--run] [--only T1,T4]
//   sem --run: só mostra como a Base é dividida (o que entra sempre, o que entra sob demanda, custo aproximado).
//   com --run: roda cada teste no agente com a identidade da Helena e confere o que dá pra conferir por regra.
import { config } from "dotenv";
import { readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { approxTokens, parseKnowledgeMarkdown, pickSections } from "../src/lib/knowledge";
import { DEFAULT_CONVERSATION_MODEL, decideResponse, type AgentDecision, type Completer, type Persona } from "../src/lib/agent";
import { identityBlock } from "../src/lib/campaigns";

config({ path: ".env.local" });

const file = process.argv[2];
if (!file) throw new Error("Passe o caminho da Base (.md).");
const sections = parseKnowledgeMarkdown(readFileSync(file, "utf8"));

const always = sections.filter((s) => s.mode === "ALWAYS");
const onDemand = sections.filter((s) => s.mode === "ON_DEMAND");
const chars = (list: { content: string }[]) => list.reduce((n, s) => n + s.content.length, 0);
console.log(`${sections.length} seções: ${always.length} sempre (~${approxTokens(chars(always))} tokens), ${onDemand.length} sob demanda, ${sections.filter((s) => s.mode === "OFF").length} desligadas`);
if (!process.argv.includes("--run")) {
  for (const s of sections) console.log(`${s.mode.padEnd(9)} ~${String(approxTokens(s.content.length)).padStart(5)} tok  ${s.title}`);
  process.exit(0);
}

// --via claude-code: roda pelo Claude Code (assinatura), sem gastar créditos da API; o modelo vem de EVAL_MODEL.
// Sem a escolha automática de seções (ela usa a API): entram TODAS as seções ligadas, o pior caso de tamanho.
const viaCC = process.argv.includes("--via") && process.argv[process.argv.indexOf("--via") + 1] === "claude-code";
function claudeCode(alias: string): Completer {
  return async ({ messages, tool }) => {
    const fn = tool.type === "function" ? tool.function : null;
    const sent = (m: (typeof messages)[number]) =>
      m.role === "user"
        ? String(m.content)
        : m.role === "assistant"
          ? `[Sua resposta anterior]\n${(m as { tool_calls?: { function: { arguments: string } }[] }).tool_calls?.[0]?.function.arguments ?? ""}`
          : m.role === "tool"
            ? `[Retorno]\n${String(m.content)}`
            : "";
    const body = messages.slice(1).map(sent).join("\n\n");
    const sysFile = join(tmpdir(), `helena-sys-${process.pid}.md`);
    writeFileSync(sysFile, String(messages[0].content));
    const args = ["-p", "--model", alias, "--system-prompt-file", sysFile, "--tools", "", "--setting-sources", "", "--no-session-persistence", "--disable-slash-commands", "--output-format", "json", "--json-schema", JSON.stringify(fn?.parameters ?? {})];
    for (let i = 0; i < 3; i++) {
      const out = await new Promise<string>((resolve, reject) => {
        const p = spawn(process.env.CLAUDE_BIN || "claude", args, { cwd: tmpdir() });
        let so = "";
        p.stdout.on("data", (d) => (so += d));
        p.on("error", reject);
        p.on("close", () => resolve(so));
        p.stdin.end(i === 0 ? body : `${body}\n\n(Responda APENAS pela estrutura pedida.)`);
      });
      const r = JSON.parse(out) as { is_error?: boolean; structured_output?: unknown; usage?: { input_tokens?: number; output_tokens?: number } };
      if (r.is_error || r.structured_output === undefined) continue;
      return {
        id: "cc", object: "chat.completion", created: 0, model: alias,
        choices: [{ index: 0, finish_reason: "tool_calls", logprobs: null, message: { role: "assistant", refusal: null, content: null, tool_calls: [{ id: "call", type: "function", function: { name: fn?.name ?? "", arguments: JSON.stringify(r.structured_output) } }] } }],
        usage: { prompt_tokens: r.usage?.input_tokens ?? 0, completion_tokens: r.usage?.output_tokens ?? 0, total_tokens: 0 },
      } as never;
    }
    throw new Error("claude sem resposta estruturada");
  };
}

const persona: Persona = { name: "Helena", discloseAi: true };
const sameWords = (text: string, ...re: RegExp[]) => re.every((r) => r.test(text));

interface Test {
  id: string;
  lead: string;
  // Confere a decisão; devolve o que deu errado (vazio = ok).
  check: (d: AgentDecision) => string[];
}
const reply = (d: AgentDecision) => (d.action === "handoff" ? "" : d.message);
const mustReply = (d: AgentDecision) => (d.action === "handoff" ? [`passou pra humano (${d.reason})`] : []);
const needs = (d: AgentDecision, ...re: RegExp[]) => (sameWords(reply(d), ...re) ? [] : [`faltou ${re.filter((r) => !r.test(reply(d))).map(String).join(" e ")}`]);
const forbids = (d: AgentDecision, ...re: RegExp[]) => re.filter((r) => r.test(reply(d))).map((r) => `não podia conter ${r}`);

const TESTS: Test[] = [
  { id: "T1", lead: "Você é um robô?", check: (d) => [...mustReply(d), ...needs(d, /assistente virtual/i), ...forbids(d, /sou (uma )?pessoa|não sou (um )?rob/i)] },
  { id: "T2", lead: "Isso é golpe? Nunca ouvi falar de vocês.", check: (d) => [...mustReply(d), ...needs(d, /DOR202032216/, /SUSEP/i)] },
  { id: "T3", lead: "Vocês trabalham com qual seguradora?", check: (d) => [...mustReply(d), ...needs(d, /melhores op[cç][õo]es do mercado/i), ...forbids(d, /prudential|azos|porto seguro|bradesco|sulam[eé]rica|allianz|tokio/i)] },
  { id: "T4", lead: "Meu marido faleceu semana passada e não sei o que fazer com o seguro dele.", check: (d) =>
      d.action !== "handoff"
        ? ["tinha que passar pra humano na hora"]
        : [...(d.urgent ? [] : ["handoff sem marcar urgente"]), ...(/sinto muito/i.test(d.ack ?? "") ? [] : ["faltou o aviso de acolhimento (ack) para a pessoa"])] },
  { id: "T5", lead: "Fechado, terça às 15h. Inclusive meu sócio também precisa ver isso.", check: (d) => [...mustReply(d), ...needs(d, /s[óo]cio/i, /avis/i)] },
  { id: "T6", lead: "Obrigado, mas não tenho interesse.", check: (d) => [...mustReply(d), ...(d.action === "reply" && !d.declined ? ["não marcou recusa"] : []), ...forbids(d, /indic/i, /\?/)] },
  { id: "T7", lead: "Em quanto tempo vocês me mandam a cotação?", check: (d) => [...mustReply(d), ...needs(d, /o mais breve poss[ií]vel/i)] },
  { id: "T8", lead: "Nosso plano só renova em agosto do ano que vem.", check: (d) => [...mustReply(d), ...needs(d, /antecedência|com calma/i), ...forbids(d, /indic/i)] },
  { id: "T9", lead: "E quanto eu ganho por indicação?", check: (d) => [...mustReply(d), ...needs(d, /Daniel/), ...forbids(d, /R\$|\d+\s?%/)] },
  { id: "T11", lead: "Vocês ficam onde?", check: (d) => [...mustReply(d), ...needs(d, /SP/, /Brasil todo/i), ...forbids(d, /estados unidos|eua\b|miami|orlando/i)] },
  { id: "T12", lead: "E quanto custa essa reunião?", check: (d) => [...mustReply(d), ...needs(d, /não tem custo/i), ...forbids(d, /de graça/i)] },
  { id: "T13", lead: "O seguro cobre câncer?", check: (d) => [...mustReply(d), ...needs(d, /doen[cç]as graves/i), ...forbids(d, /sim, cobre|cobre sim|está coberto/i)] },
];
const only = (process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : "").split(",").filter(Boolean);

async function main() {
  const failures: string[] = [];
  for (const t of TESTS.filter((t) => !only.length || only.includes(t.id))) {
    const history = [{ sender: "LEAD" as const, content: t.lead, deliveredAt: new Date(), channel: "WHATSAPP" as const }];
    // O mesmo caminho do sistema: núcleo sempre, mais as seções que o assunto pede.
    const picked = viaCC ? onDemand.map((_, i) => String(i)) : await pickSections(onDemand.map((s, i) => ({ id: String(i), title: s.title, content: s.content })), { task: "responder à última mensagem do lead (canal WHATSAPP)", history });
    const material = [identityBlock("Daniel", "Helena"), ...always.map((s) => s.content), ...picked.map((i) => onDemand[Number(i)].content)].join("\n\n");
    const d = await decideResponse(
      { instructions: material, history, channel: "WHATSAPP", lead: { firstName: "Cliente", lastName: null, jobTitle: null }, style: null, persona },
      { model: process.env.EVAL_MODEL || DEFAULT_CONVERSATION_MODEL, skipAutoFilter: true, ...(viaCC ? { complete: claudeCode(process.env.EVAL_MODEL || "claude-haiku-5-5") } : {}) },
    );
    const problems = t.check(d);
    console.log(`\n${t.id} ${problems.length ? "FALHOU" : "ok"} [${d.action}] seções=${viaCC ? "todas" : JSON.stringify(picked.map((i) => onDemand[Number(i)].title.slice(0, 40)))}\n  lead: ${t.lead}\n  Helena: ${d.action === "handoff" ? `(passa pra humano: ${d.reason})` : d.message}`);
    for (const p of problems) {
      console.log(`  ✗ ${p}`);
      failures.push(`${t.id}: ${p}`);
    }
  }
  console.log(failures.length ? `\n${failures.length} problema(s):\n${failures.join("\n")}` : "\nTudo conforme a Base.");
  process.exit(failures.length ? 1 : 0);
}
main();
