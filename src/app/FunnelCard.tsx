import { IconChevronRight } from "@/components/Icons";

export interface FunnelStep {
  label: string;
  value: number;
}

// Resumo do funil: taxa de resposta em destaque + barras de conversão por etapa.
// Uma série só (todas as etapas medem o mesmo tipo de coisa: leads), então uma
// cor só, com o número sempre escrito ao lado — a cor nunca é a única leitura.
export function FunnelCard({ steps, contacted, replied }: { steps: FunnelStep[]; contacted: number; replied: number }) {
  const top = Math.max(1, steps[0]?.value ?? 0);
  const rate = contacted > 0 ? Math.round((replied / contacted) * 100) : null;

  return (
    <section className="card card-pad rise" aria-labelledby="funnel-title" style={{ "--i": 1 } as React.CSSProperties}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", gap: 12, marginBottom: 16 }}>
        <div className="stack" style={{ gap: 2 }}>
          <h2 id="funnel-title" className="section-title" style={{ padding: 0 }}>
            Taxa de resposta
          </h2>
          <span className="funnel-rate">{rate === null ? "—" : `${rate}%`}</span>
        </div>
        <p className="tiny faint" style={{ textAlign: "right", maxWidth: 170 }}>
          {contacted > 0
            ? `${replied} de ${contacted} lead${contacted > 1 ? "s" : ""} contatado${contacted > 1 ? "s" : ""} respondeu${replied !== 1 ? "ram" : ""}`
            : "Ainda sem leads contatados"}
        </p>
      </div>

      <ol className="funnel" aria-label="Funil de leads">
        {steps.map((step, i) => {
          const pct = Math.round((step.value / top) * 100);
          const fromPrev = i > 0 && steps[i - 1].value > 0 ? Math.round((step.value / steps[i - 1].value) * 100) : null;
          return (
            <li key={step.label} title={`${step.label}: ${step.value} de ${steps[0].value} (${pct}%)`}>
              <div className="funnel-head">
                <span className="funnel-label">{step.label}</span>
                <span className="funnel-value">
                  {step.value}
                  {fromPrev !== null && (
                    <span className="funnel-step">
                      <IconChevronRight size={11} strokeWidth={3} />
                      {fromPrev}%
                    </span>
                  )}
                </span>
              </div>
              <div className="funnel-track" aria-hidden="true">
                <span style={{ width: `${Math.max(step.value > 0 ? 2 : 0, pct)}%` }} />
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
