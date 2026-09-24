import { IconSparkles } from "@/components/Icons";
import { AutomationSwitch } from "./AutomationSwitch";

export interface DayBar {
  label: string;
  value: number;
}

// "Mantenha o ritmo!": mensagens enviadas nos últimos 7 dias, taxa de resposta
// e o quanto do limite de hoje já foi usado. Só números reais do banco.
export function RhythmCard({
  days,
  replyRate,
  sentToday,
  dailyLimit,
  paused,
}: {
  days: DayBar[];
  replyRate: number | null;
  sentToday: number;
  dailyLimit: number;
  paused: boolean;
}) {
  const max = Math.max(1, ...days.map((d) => d.value));
  const total = days.reduce((a, d) => a + d.value, 0);
  const message =
    total === 0
      ? "Nenhuma mensagem nos últimos 7 dias. Ative o agente ou convide novas pessoas."
      : replyRate === null
        ? `${total} mensage${total > 1 ? "ns enviadas" : "m enviada"} nos últimos 7 dias.`
        : `${replyRate}% dos leads contatados responderam. ${total} mensage${total > 1 ? "ns" : "m"} em 7 dias.`;

  return (
    <section className="card rhythm-card" aria-labelledby="rhythm-title">
      <span className="rhythm-icon">
        <IconSparkles size={20} />
      </span>
      <div className="stack" style={{ gap: 4 }}>
        <h2 id="rhythm-title" className="rhythm-title">
          Mantenha o ritmo!
        </h2>
        <p className="small muted">{message}</p>
      </div>
      <div className="rhythm-body">
        <div className="rhythm-bars" role="img" aria-label={`Mensagens por dia: ${days.map((d) => `${d.label} ${d.value}`).join(", ")}`}>
          {days.map((d, i) => (
            <span key={i} className={`rhythm-bar${i < 3 ? " warm" : ""}`} style={{ height: `${Math.max(10, (d.value / max) * 100)}%` }} title={`${d.label}: ${d.value}`} />
          ))}
        </div>
        <div className="rhythm-stats">
          <div>
            <b>{replyRate === null ? "—" : `${replyRate}%`}</b>
            <span>Taxa de resposta</span>
          </div>
          <div>
            <b>
              {sentToday}
              <small>/{dailyLimit}</small>
            </b>
            <span>Enviadas hoje</span>
          </div>
        </div>
      </div>
      <div className="hero-divider" />
      <AutomationSwitch paused={paused} />
    </section>
  );
}
