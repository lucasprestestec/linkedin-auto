import { prisma } from "@/lib/prisma";
import { dayKeyOf } from "@/lib/format";
import { MobileHeader } from "@/components/MobileHeader";
import { IconChat, IconCheck, IconSend, IconUsers } from "@/components/Icons";
import { FunnelCard, type FunnelStep } from "../FunnelCard";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const DAYS = 14;

// Estatísticas: só o que está no banco — funil, mensagens por dia e campanhas.
function periodStart() {
  const since = new Date(Date.now() - (DAYS - 1) * DAY_MS);
  since.setHours(0, 0, 0, 0);
  return since;
}

export default async function StatsPage() {
  const since = periodStart();
  const outbound = { some: { sender: { in: ["AGENT" as const, "HUMAN" as const] } } };
  const inbound = { some: { sender: "LEAD" as const } };

  const [leads, messages, contacted, repliedAfterContact, replied, campaigns] = await Promise.all([
    prisma.lead.findMany({ select: { status: true, campaignId: true, messages: { select: { sender: true }, take: 50 } } }),
    prisma.message.findMany({ where: { deliveredAt: { gte: since } }, select: { sender: true, deliveredAt: true } }),
    prisma.lead.count({ where: { messages: outbound } }),
    prisma.lead.count({ where: { AND: [{ messages: outbound }, { messages: inbound }] } }),
    prisma.lead.count({ where: { messages: inbound } }),
    prisma.campaign.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const qualified = leads.filter((l) => l.status === "QUALIFIED").length;
  const connected = leads.filter((l) => l.status !== "INVITE_SENT").length;
  const steps: FunnelStep[] = [
    { label: "Leads", value: leads.length },
    { label: "Conectados", value: connected },
    { label: "Contatados", value: contacted },
    { label: "Responderam", value: replied },
    { label: "Qualificados", value: qualified },
  ];

  // Mensagens por dia: enviadas (IA + você) x recebidas.
  const days = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(since.getTime() + i * DAY_MS);
    return { key: dayKeyOf(d), label: d.toLocaleDateString("pt-BR", { day: "2-digit", timeZone: "America/Sao_Paulo" }), sent: 0, received: 0 };
  });
  const byKey = new Map(days.map((d) => [d.key, d]));
  for (const m of messages) {
    const day = byKey.get(dayKeyOf(m.deliveredAt));
    if (!day) continue;
    if (m.sender === "LEAD") day.received++;
    else day.sent++;
  }
  const max = Math.max(1, ...days.map((d) => Math.max(d.sent, d.received)));
  const sentTotal = days.reduce((a, d) => a + d.sent, 0);
  const receivedTotal = days.reduce((a, d) => a + d.received, 0);

  const byCampaign = [...campaigns.map((c) => ({ id: c.id, name: c.name })), { id: null, name: "Sem campanha" }]
    .map((c) => {
      const list = leads.filter((l) => l.campaignId === c.id);
      const talked = list.filter((l) => l.messages.some((m) => m.sender !== "LEAD"));
      const answered = talked.filter((l) => l.messages.some((m) => m.sender === "LEAD"));
      return {
        ...c,
        leads: list.length,
        rate: talked.length ? Math.round((answered.length / talked.length) * 100) : null,
        qualified: list.filter((l) => l.status === "QUALIFIED").length,
      };
    })
    .filter((c) => c.leads > 0);

  const kpis = [
    { label: "Leads", value: leads.length, Icon: IconUsers, tone: "lav" },
    { label: "Taxa de resposta", value: contacted ? `${Math.round((repliedAfterContact / contacted) * 100)}%` : "—", Icon: IconChat, tone: "peach" },
    { label: `Enviadas em ${DAYS} dias`, value: sentTotal, Icon: IconSend, tone: "cream" },
    { label: "Qualificados", value: qualified, Icon: IconCheck, tone: "lav" },
  ];

  return (
    <main className="page">
      <MobileHeader />
      <header className="page-hero rise">
        <h1 className="display page-title">
          Estatís<span className="name-grad">ticas.</span>
        </h1>
        <p className="hero-sub">Como a prospecção está indo — tudo calculado das suas conversas.</p>
      </header>

      <div className="kpi-grid rise" style={{ "--i": 1 } as React.CSSProperties}>
        {kpis.map(({ label, value, Icon, tone }) => (
          <div key={label} className={`stat-tile kpi tile-${tone}`}>
            <span className="stat-tile-icon">
              <Icon size={20} />
            </span>
            <b className="stat-tile-num">{value}</b>
            <span className="stat-tile-label">{label}</span>
          </div>
        ))}
      </div>

      <div className="two-col">
        <section className="card card-pad stack rise" style={{ gap: 16, "--i": 2 } as React.CSSProperties} aria-labelledby="daily-title">
          <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <h2 id="daily-title" className="rhythm-title">
              Mensagens por dia
            </h2>
            <div className="row legend" style={{ gap: 14 }}>
              <span>
                <i className="legend-dot sent" /> Enviadas ({sentTotal})
              </span>
              <span>
                <i className="legend-dot received" /> Recebidas ({receivedTotal})
              </span>
            </div>
          </div>
          <div className="daily-chart" role="img" aria-label={`Últimos ${DAYS} dias: ${sentTotal} mensagens enviadas e ${receivedTotal} recebidas`}>
            {days.map((d) => (
              <div key={d.key} className="daily-col" title={`${d.label}: ${d.sent} enviadas, ${d.received} recebidas`}>
                <div className="daily-bars">
                  <span className="daily-bar sent" style={{ height: `${(d.sent / max) * 100}%` }} />
                  <span className="daily-bar received" style={{ height: `${(d.received / max) * 100}%` }} />
                </div>
                <span className="daily-label">{d.label}</span>
              </div>
            ))}
          </div>
        </section>

        <FunnelCard steps={steps} contacted={contacted} replied={repliedAfterContact} />
      </div>

      {byCampaign.length > 0 && (
        <section className="card card-pad rise" style={{ "--i": 3 } as React.CSSProperties} aria-labelledby="camp-title">
          <h2 id="camp-title" className="rhythm-title" style={{ marginBottom: 12 }}>
            Por campanha
          </h2>
          <div style={{ overflowX: "auto" }}>
            <table className="leads-table stats-table">
              <thead>
                <tr>
                  <th>Campanha</th>
                  <th>Leads</th>
                  <th>Taxa de resposta</th>
                  <th>Qualificados</th>
                </tr>
              </thead>
              <tbody>
                {byCampaign.map((c) => (
                  <tr key={c.id ?? "none"}>
                    <td className="cell-strong">{c.name}</td>
                    <td>{c.leads}</td>
                    <td>{c.rate === null ? "—" : `${c.rate}%`}</td>
                    <td>{c.qualified}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
