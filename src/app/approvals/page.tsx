import { prisma } from "@/lib/prisma";
import { MobileHeader } from "@/components/MobileHeader";
import { CHANNEL_LABEL } from "@/lib/channels";
import { relativeTime } from "@/lib/format";
import { approvalStats } from "@/lib/outbox";
import { ApprovalCard, type ApprovalItem } from "./ApprovalCard";
import { ApprovalToggle } from "./ApprovalToggle";

export const dynamic = "force-dynamic";

const KIND_LABEL = {
  REPLY: "Resposta",
  OPENING: "Abertura",
  FIRST_CONTACT: "Primeiro contato",
  INTRO_EMAIL: "Apresentação por e-mail",
  FOLLOW_UP: "Retomada",
} as const;

// Só passa a sugerir desligar a aprovação depois de amostra suficiente.
const TRUST_MIN_DECIDED = 30;
const TRUST_MIN_RATE = 0.9;

export default async function ApprovalsPage() {
  const [settings, pending, waiting, stats] = await Promise.all([
    prisma.settings.findUniqueOrThrow({ where: { id: "singleton" }, select: { approvalMode: true, workStartHour: true, workEndHour: true } }),
    prisma.draft.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, include: { lead: { select: { firstName: true, lastName: true, jobTitle: true } } } }),
    prisma.draft.count({ where: { status: "APPROVED" } }),
    approvalStats(),
  ]);

  const items: ApprovalItem[] = pending.map((d) => ({
    id: d.id,
    leadId: d.leadId,
    firstName: d.lead.firstName,
    lastName: d.lead.lastName,
    jobTitle: d.lead.jobTitle,
    channel: CHANNEL_LABEL[d.channel],
    kind: KIND_LABEL[d.kind],
    subject: d.subject,
    content: d.content,
    reason: d.reason,
    when: relativeTime(d.createdAt),
  }));

  const rate = stats.decided ? stats.untouched / stats.decided : 0;
  const trusted = stats.decided >= TRUST_MIN_DECIDED && rate >= TRUST_MIN_RATE;

  return (
    <main className="page">
      <MobileHeader />
      <header>
        <h1 className="display page-title">Aprovações</h1>
        <p className="hero-sub">
          {settings.approvalMode
            ? "A secretária escreve, você dá o OK. Nada sai sem a sua aprovação."
            : "Aprovação desligada: a secretária envia sozinha. Ligue de novo se quiser revisar antes."}
        </p>
      </header>

      <section className="panel" style={{ padding: 16, display: "grid", gap: 10 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <strong>Aprovar antes de enviar</strong>
          <ApprovalToggle on={settings.approvalMode} />
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          {stats.decided === 0
            ? "Quando você aprovar as primeiras mensagens, mostro aqui quantas a secretária acertou sem você mexer."
            : trusted
              ? `A secretária acertou ${stats.untouched} de ${stats.decided} sem você mexer. Já dá pra desligar a aprovação com segurança.`
              : `Aprovadas sem mudar nada: ${stats.untouched} de ${stats.decided} (as últimas ${TRUST_MIN_DECIDED}). Com ${TRUST_MIN_DECIDED} decisões e 90% de acerto, sugiro liberar o automático.`}
        </p>
      </section>

      {waiting > 0 && (
        <p className="small muted" role="status">
          {waiting} mensagem{waiting > 1 ? "ns" : ""} já aprovada{waiting > 1 ? "s" : ""} aguardando o horário de trabalho ({settings.workStartHour}h às {settings.workEndHour}h).
        </p>
      )}

      {items.length === 0 ? (
        <section className="panel" style={{ padding: 24 }}>
          <p className="panel-empty">Nada esperando sua aprovação agora.</p>
        </section>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {items.map((item) => (
            <ApprovalCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </main>
  );
}
