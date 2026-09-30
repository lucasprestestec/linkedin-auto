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
      <header className="p-head">
        <div>
          <h1 className="t-title">Aprovações</h1>
          <p className="t-sub">
            {settings.approvalMode
              ? "A secretária escreve, você dá o OK. Nada sai sem a sua aprovação."
              : "Aprovação desligada: a secretária envia sozinha."}
          </p>
        </div>
      </header>

      <section className="sec">
        <div className="setting" style={{ padding: 0 }}>
          <span className="setting-text">
            <b>Aprovar antes de enviar</b>
            <small>
              {stats.decided === 0
                ? "Quando você aprovar as primeiras mensagens, mostro quantas a secretária acertou sem você mexer."
                : trusted
                  ? `Acertou ${stats.untouched} de ${stats.decided} sem você mexer. Já dá para desligar a aprovação com segurança.`
                  : `Aprovadas sem mudar nada: ${stats.untouched} de ${stats.decided}. Com ${TRUST_MIN_DECIDED} decisões e 90% de acerto, sugiro liberar o automático.`}
            </small>
          </span>
          <ApprovalToggle on={settings.approvalMode} />
        </div>
      </section>

      {waiting > 0 && (
        <p className="note" role="status">
          {waiting} mensage{waiting > 1 ? "ns" : "m"} já aprovada{waiting > 1 ? "s" : ""} aguardando o horário de trabalho ({settings.workStartHour}h às {settings.workEndHour}h).
        </p>
      )}

      {items.length === 0 ? (
        <section className="sec">
          <p className="empty">Nada esperando sua aprovação agora.</p>
        </section>
      ) : (
        <div className="stack" style={{ gap: 16 }}>
          {items.map((item) => (
            <ApprovalCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </main>
  );
}
