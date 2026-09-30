// Bateria do banco de testes do agente, por linha de comando.
// Uso: npx tsx scripts/eval-bench.ts --models a,b --judge j --runs 3 --out resultado.json [--only id1,id2] [--via claude-code | --via codex --effort medium | --judge-via claude-code]
import { config } from "dotenv";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Completer } from "../src/lib/agent";

config({ path: ".env.local" });

const arg = (name: string, fallback = "") => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};

// Chama o Claude Code em modo programÃ¡tico (usa a assinatura, nÃ£o a API). Roda numa pasta vazia,
// sem ferramentas, sem configuraÃ§Ãµes nem skills, pra responder sÃ³ com o prompt do agente.
const EMPTY_DIR = join(tmpdir(), "eval-cc");
mkdirSync(EMPTY_DIR, { recursive: true });

function claudeCode(alias: string): Completer {
  return async ({ messages, tool }) => {
    const system = String(messages[0].content);
    const body = messages
      .slice(1)
      .map((m) => {
        if (m.role === "user") return String(m.content);
        if (m.role === "assistant") return `[Sua resposta anterior]\n${(m as { tool_calls?: { function: { arguments: string } }[] }).tool_calls?.[0]?.function.arguments ?? ""}`;
        if (m.role === "tool") return `[Retorno]\n${String(m.content)}`;
        return "";
      })
      .join("\n\n");
    const fn = tool.type === "function" ? tool.function : null;
    const args = [
      "-p", "--model", alias, "--system-prompt", system, "--tools", "", "--setting-sources", "",
      "--no-session-persistence", "--disable-slash-commands", "--output-format", "json",
      "--json-schema", JSON.stringify(fn?.parameters ?? {}),
    ];
    const once = (input: string) =>
      new Promise<string>((resolve, reject) => {
        const p = spawn("claude", args, { cwd: EMPTY_DIR });
        let so = "";
        let se = "";
        p.stdout.on("data", (d) => (so += d));
        p.stderr.on("data", (d) => (se += d));
        p.on("error", reject);
        p.on("close", (code) => (code === 0 || so ? resolve(so) : reject(new Error(`claude saiu com ${code}: ${se.slice(0, 200)}`))));
        p.stdin.end(input);
      });
    type Out = { is_error?: boolean; result?: string; structured_output?: unknown; usage?: { input_tokens?: number; output_tokens?: number }; total_cost_usd?: number };
    // Ã€s vezes o modelo responde em texto em vez de usar a estrutura pedida: tenta de novo (atÃ© 3 vezes).
    let r: Out = {};
    let parsed: unknown;
    let cost = 0;
    let lastErr = "";
    for (let i = 0; i < 3 && parsed === undefined; i++) {
      r = JSON.parse(await once(i === 0 ? body : `${body}

(Responda APENAS pela estrutura pedida, sem texto fora dela.)`)) as Out;
      cost += r.total_cost_usd ?? 0;
      if (r.is_error) { lastErr = `claude: ${String(r.result).slice(0, 200)}`; continue; }
      parsed = r.structured_output;
    }
    if (parsed === undefined) throw new Error(lastErr || "sem resposta estruturada");
    return {
      id: "cc", object: "chat.completion", created: 0, model: alias,
      choices: [{ index: 0, finish_reason: "tool_calls", logprobs: null, message: { role: "assistant", refusal: null, content: null, tool_calls: [{ id: "call", type: "function", function: { name: fn?.name ?? "", arguments: JSON.stringify(parsed) } }] } }],
      usage: { prompt_tokens: r.usage?.input_tokens ?? 0, completion_tokens: r.usage?.output_tokens ?? 0, total_tokens: 0, ...(cost ? { cost } : {}) },
    } as never;
  };
}

// Codex (assinatura da OpenAI): usa o codex.exe do app desktop (o do npm pode ser velho e nÃ£o ter o modelo).
// As instruÃ§Ãµes de programador do Codex sÃ£o trocadas pelo prompt do agente (model_instructions_file).
// A saÃ­da estruturada da OpenAI exige todos os campos obrigatÃ³rios: os opcionais viram "campo ou null".
const CODEX_BIN = process.env.CODEX_BIN || join(process.env.LOCALAPPDATA ?? "", "OpenAI", "Codex", "bin", "c6fe824d725f02d7", "codex.exe");

function strictSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strictSchema);
  if (!node || typeof node !== "object") return node;
  const o = { ...(node as Record<string, unknown>) };
  if (o.properties && typeof o.properties === "object") {
    const props = o.properties as Record<string, Record<string, unknown>>;
    const req = new Set((o.required as string[] | undefined) ?? []);
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(props)) {
      const sv = strictSchema(v) as Record<string, unknown>;
      next[k] = req.has(k) || typeof sv.type !== "string" ? sv : { ...sv, type: [sv.type, "null"] };
    }
    o.properties = next;
    o.required = Object.keys(next);
    o.additionalProperties = false;
  }
  if (o.items) o.items = strictSchema(o.items);
  delete o.minimum;
  delete o.maximum;
  return o;
}

function codex(slug: string, effort: string): Completer {
  return async ({ messages, tool }) => {
    const id = randomUUID();
    const sysFile = join(EMPTY_DIR, `${id}.md`).replace(/\\/g, "/");
    const schemaFile = join(EMPTY_DIR, `${id}.json`);
    const fn = tool.type === "function" ? tool.function : null;
    writeFileSync(sysFile, String(messages[0].content));
    writeFileSync(schemaFile, JSON.stringify(strictSchema(fn?.parameters ?? {})));
    const body = messages
      .slice(1)
      .map((m) => {
        if (m.role === "user") return String(m.content);
        if (m.role === "assistant") return `[Sua resposta anterior]\n${(m as { tool_calls?: { function: { arguments: string } }[] }).tool_calls?.[0]?.function.arguments ?? ""}`;
        if (m.role === "tool") return `[Retorno]\n${String(m.content)}`;
        return "";
      })
      .join("\n\n");
    const args = [
      "exec", "--ephemeral", "--skip-git-repo-check", "--ignore-user-config", "--ignore-rules", "-s", "read-only",
      "-m", slug, "-c", `model_reasoning_effort=${effort}`, "-c", `model_instructions_file="${sysFile}"`,
      "--output-schema", schemaFile, "--json", "-",
    ];
    try {
      let lastErr = "";
      for (let i = 0; i < 3; i++) {
        const out = await new Promise<string>((resolve, reject) => {
          const p = spawn(CODEX_BIN, args, { cwd: EMPTY_DIR });
          let so = "";
          p.stdout.on("data", (d) => (so += d));
          p.on("error", reject);
          p.on("close", () => resolve(so));
          p.stdin.end(body);
        });
        let text = "";
        let usage: { input_tokens?: number; output_tokens?: number } = {};
        for (const line of out.split("\n")) {
          try {
            const ev = JSON.parse(line) as { type?: string; item?: { type?: string; text?: string }; usage?: typeof usage; message?: string };
            if (ev.type === "item.completed" && ev.item?.type === "agent_message") text = ev.item.text ?? "";
            if (ev.type === "turn.completed") usage = ev.usage ?? {};
            if (ev.type === "turn.failed" || ev.type === "error") lastErr = String(ev.message ?? line).slice(0, 200);
          } catch {}
        }
        if (!text) continue;
        // Campos "null" voltam a ser "ausentes", como na chamada normal.
        const parsed = JSON.parse(text, (_k, v) => (v === null ? undefined : v));
        return {
          id: "cx", object: "chat.completion", created: 0, model: slug,
          choices: [{ index: 0, finish_reason: "tool_calls", logprobs: null, message: { role: "assistant", refusal: null, content: null, tool_calls: [{ id: "call", type: "function", function: { name: fn?.name ?? "", arguments: JSON.stringify(parsed) } }] } }],
          usage: { prompt_tokens: usage.input_tokens ?? 0, completion_tokens: usage.output_tokens ?? 0, total_tokens: 0 },
        } as never;
      }
      throw new Error(`codex sem resposta: ${lastErr}`);
    } finally {
      rmSync(sysFile, { force: true });
      rmSync(schemaFile, { force: true });
    }
  };
}

async function main() {
  const { SCENARIOS } = await import("../src/lib/agentEval/scenarios");
  const { runScenario } = await import("../src/lib/agentEval/run");

  const models = arg("models").split(",").filter(Boolean);
  const judge = arg("judge") || null;
  // --via claude-code: os modelos (e o avaliador) viram apelidos do Claude Code (sonnet, opus), sem gastar a API.
  const via = arg("via");
  const viaCC = via === "claude-code";
  const viaCodex = via === "codex";
  const effort = arg("effort", "medium");
  // --judge-via claude-code: os modelos rodam pela API (Nous), mas o avaliador roda no Claude Code (sem gastar API).
  const judgeViaCC = viaCC || arg("judge-via") === "claude-code";
  const runs = Number(arg("runs", "1"));
  const concurrency = Number(arg("concurrency", "6"));
  const out = arg("out", "eval-result.json");
  const only = arg("only").split(",").filter(Boolean);
  const scenarios = only.length ? SCENARIOS.filter((s) => only.includes(s.id)) : SCENARIOS;

  const jobs = models.flatMap((model) => scenarios.flatMap((s) => Array.from({ length: runs }, (_, run) => ({ model, id: s.id, run }))));
  console.log(`${jobs.length} execuções (${models.length} modelos × ${scenarios.length} cenários × ${runs})`);

  const results: (Awaited<ReturnType<typeof runScenario>> & { run: number })[] = [];
  let next = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < jobs.length) {
        const job = jobs[next++];
        const r = await runScenario(job.id, job.model, judge, { complete: viaCC ? claudeCode(job.model) : viaCodex ? codex(job.model, effort) : undefined, judgeComplete: judgeViaCC && judge ? claudeCode(judge) : undefined });
        results.push({ ...r, run: job.run });
        done++;
        if (done % 20 === 0) console.log(`${done}/${jobs.length}`);
      }
    }),
  );
  writeFileSync(out, JSON.stringify({ models, judge, runs, results }, null, 1));
  console.log(`salvo em ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
