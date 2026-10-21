"use client";

import { useMemo, useState, useTransition } from "react";
import { CLIENT_FIELDS, FIELDS, FIELD_LABEL, detectColumns, type Field } from "@/lib/contactImport";
import { readXlsx, rowsToCsv } from "@/lib/xlsx";
import { importContacts, type ImportFirstContact, type ImportResult } from "./actions";

const EXAMPLE = "Nome;Sobrenome;E-mail;Telefone;Empresa;Cargo;Indicado por;Tipo;Observações";

const FIRST: { id: ImportFirstContact; label: string; hint: string }[] = [
  { id: "EMAIL", label: "O assistente se apresenta por e-mail", hint: "Usa a mensagem inicial da campanha, no próximo horário de trabalho, dentro do limite das caixas de envio." },
  { id: "WHATSAPP", label: "O assistente se apresenta pelo WhatsApp", hint: "Só para quem tem telefone na planilha." },
  { id: "ME", label: "Eu mesmo começo", hint: "Os contatos só entram no sistema. Nada é enviado." },
];

// Importa uma planilha de contatos: primeiro confere (sem salvar nada), depois importa.
export function ImportForm({ campaigns }: { campaigns: { id: string; name: string }[] }) {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState("");
  const [first, setFirst] = useState<ImportFirstContact>("EMAIL");
  const [override, setOverride] = useState<(Field | "")[] | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [checked, setChecked] = useState(false);
  const [pending, start] = useTransition();

  function reset() {
    setResult(null);
    setChecked(false);
  }

  const detected = useMemo(() => (text.trim() ? detectColumns(text) : null), [text]);
  const mapping = override ?? detected?.mapping ?? [];
  const isClients = mapping.some((f) => f && CLIENT_FIELDS.includes(f));

  async function onFile(file: File | undefined) {
    reset();
    setOverride(null);
    setFileError(null);
    if (!file) return;
    try {
      // Excel (.xlsx) é convertido aqui mesmo; o resto é lido como texto (CSV, TXT, planilha colada).
      const csv = file.name.toLowerCase().endsWith(".xlsx") ? rowsToCsv(readXlsx(new Uint8Array(await file.arrayBuffer()))) : await file.text();
      setFileName(file.name);
      setText(csv);
      if (detectColumns(csv)?.mapping.some((f) => f && CLIENT_FIELDS.includes(f))) setFirst("ME");
    } catch (e) {
      setFileName(null);
      setText("");
      setFileError(e instanceof Error ? e.message : "Não consegui ler o arquivo.");
    }
  }

  const run = (commit: boolean) =>
    start(async () => {
      const r = await importContacts({ text, campaignId, firstContact: first, commit, mapping: override ?? undefined });
      setResult(r);
      setChecked(!r.error && !commit);
    });

  const done = result?.created != null;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <section className="sec">
        <h2 className="t-label">1. A planilha</h2>
        <label>
          <span className="label">Arquivo (Excel .xlsx, .csv ou .txt)</span>
          <input className="field" type="file" accept=".xlsx,.csv,.tsv,.txt,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <label>
          <span className="label">ou cole as linhas aqui</span>
          <textarea
            className="field"
            rows={5}
            value={fileName ? "" : text}
            disabled={Boolean(fileName)}
            onChange={(e) => {
              reset();
              setOverride(null);
              setText(e.target.value);
            }}
            placeholder={EXAMPLE}
          />
        </label>
        {fileName && (
          <p className="hint" style={{ margin: 0 }}>
            Arquivo: {fileName}.{" "}
            <button
              type="button"
              className="btn-text"
              onClick={() => {
                setFileName(null);
                setText("");
                setOverride(null);
                reset();
              }}
            >
              Trocar
            </button>
          </p>
        )}
        {fileError && <p className="field-error">{fileError}</p>}
        <p className="hint" style={{ margin: 0 }}>
          A primeira linha traz os títulos. Obrigatório: o nome e pelo menos um de E-mail, Telefone ou LinkedIn. Também entendo Sobrenome, Empresa, Cargo, Indicado por, Tipo (pessoa,
          empresa, candidato, parceiro) e Observações. Para a carteira de clientes, inclua também Vencimento (ou Renovação), Produto, Seguradora, Apólice e Valor; o vencimento pode estar em qualquer formato de data. Planilhas de Excel (.xlsx) e texto copiado do Excel funcionam direto. Exemplo de títulos: <code>{EXAMPLE}</code>
        </p>
      </section>

      {detected && (
        <section className="sec">
          <h2 className="t-label">Como entendi as colunas</h2>
          <p className="hint" style={{ margin: 0 }}>
            Confira. Se alguma estiver errada, escolha o campo certo (ou “Não usar”).
          </p>
          <div style={{ overflowX: "auto" }}>
            <table className="small" style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "4px 8px" }}>Coluna da planilha</th>
                  <th style={{ textAlign: "left", padding: "4px 8px" }}>Exemplo</th>
                  <th style={{ textAlign: "left", padding: "4px 8px" }}>Campo</th>
                </tr>
              </thead>
              <tbody>
                {detected.headers.map((h, i) => (
                  <tr key={i}>
                    <td style={{ padding: "4px 8px" }}>{h || <i className="muted">(sem título)</i>}</td>
                    <td className="muted" style={{ padding: "4px 8px", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {detected.sample.map((r) => r[i]).find((v) => v?.trim()) ?? ""}
                    </td>
                    <td style={{ padding: "4px 8px" }}>
                      <select
                        className="field"
                        aria-label={`Campo da coluna ${h || i + 1}`}
                        value={mapping[i] ?? ""}
                        onChange={(e) => {
                          const next = [...mapping];
                          next[i] = e.target.value as Field | "";
                          setOverride(next);
                          reset();
                          if (next.some((f) => f && CLIENT_FIELDS.includes(f))) setFirst("ME");
                        }}
                      >
                        <option value="">Não usar</option>
                        {FIELDS.map((f) => (
                          <option key={f} value={f}>
                            {FIELD_LABEL[f]}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isClients && (
            <p className="hint" style={{ margin: 0 }}>
              Esta planilha é de <b>clientes</b>: eles entram com a etiqueta “cliente”, o vencimento aparece na tela Hoje quando chegar perto, e quem já está no sistema só recebe o vencimento. Por segurança, o primeiro contato fica por sua conta.
            </p>
          )}
        </section>
      )}

      <section className="sec">
        <h2 className="t-label">2. Para onde vão</h2>
        <label>
          <span className="label">Campanha</span>
          <select
            className="field"
            value={campaignId}
            onChange={(e) => {
              setCampaignId(e.target.value);
              reset();
            }}
          >
            <option value="">Sem campanha</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <div className="stack" style={{ gap: 8 }}>
          <span className="label">Primeiro contato</span>
          {FIRST.map((o) => (
            <label key={o.id} className="row" style={{ gap: 8, alignItems: "flex-start" }}>
              <input
                type="radio"
                name="first"
                checked={first === o.id}
                onChange={() => {
                  setFirst(o.id);
                  reset();
                }}
              />
              <span>
                <b>{o.label}</b>
                <br />
                <small className="hint">{o.hint}</small>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="sec">
        <h2 className="t-label">3. Conferir e importar</h2>
        <div className="form-actions">
          <button type="button" className="btn-line btn-sm" disabled={pending || !text.trim() || done} onClick={() => run(false)}>
            {pending && !checked ? "Conferindo…" : "Conferir a planilha"}
          </button>
          {checked && (result?.toCreate || result?.updated) ? (
            <button type="button" className="btn-solid btn-sm" disabled={pending} onClick={() => run(true)}>
              {pending ? "Importando…" : `Importar ${(result.toCreate ?? 0) + (result.updated ?? 0)} ${(result.toCreate ?? 0) + (result.updated ?? 0) === 1 ? "contato" : "contatos"}`}
            </button>
          ) : null}
        </div>

        {result?.error && <p className="field-error">{result.error}</p>}
        {done && (
          <p className="ok-text">
            {result.created} {result.created === 1 ? "contato importado" : "contatos importados"}
            {(result.updated ?? 0) > 0 && ` e ${result.updated} atualizados com o vencimento`}. Eles aparecem em Conversas.
          </p>
        )}

        {result && result.total != null && (
          <div className="stack" style={{ gap: 8 }}>
            <p style={{ margin: 0 }}>
              <b>{result.total}</b> linhas na planilha: <b>{result.toCreate}</b> novas · {(result.updated ?? 0) > 0 && <><b>{result.updated}</b> clientes que já existiam receberão o vencimento · </>}{result.existing} já estão no sistema · {result.excluded} na lista de quem nunca contatar ·{" "}
              {result.invalid} com problema.
            </p>
            {result.ignored && result.ignored.length > 0 && <p className="hint" style={{ margin: 0 }}>Colunas que não usei: {result.ignored.join(", ")}.</p>}
            {result.sample && result.sample.length > 0 && (
              <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>
                {result.sample.map((s) => (
                  <li key={s.line}>
                    {s.name} · {s.contact}
                  </li>
                ))}
              </ul>
            )}
            {result.problems && result.problems.length > 0 && (
              <details className="fold">
                <summary>Linhas que não entram ({result.problems.length}{(result.invalid ?? 0) + (result.existing ?? 0) + (result.excluded ?? 0) > result.problems.length ? "+" : ""})</summary>
                <div className="fold-body">
                  <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>
                    {result.problems.map((p, i) => (
                      <li key={i}>
                        Linha {p.line}: {p.message}
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
