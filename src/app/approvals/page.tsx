import { prisma } from "@/lib/prisma";
import { MobileHeader } from "@/components/MobileHeader";
import { approvalStats } from "@/lib/outbox";
import { loadApprovalItems } from "@/lib/approvalItems";
import { ApprovalCard } from "./ApprovalCard";
import { ApprovalToggle } from "./ApprovalToggle";

export const dynamic = "force-dynamic";

// Só passa a sugerir desligar a aprovação depois de amostra suficiente.
const TRUST_MIN_DECIDED = 30;
const TRUST_MIN_RATE = 0.9;

export default async function ApprovalsPage() {
  const [settings, items, waiting, stats] = await Promise.all([
    prisma.settings.findUniqueOrThrow({ where: { id: "singleton" }, select: { approvalMode: true, workStartHour: true, workEndHour: true } }),
    loadApprovalItems({ status: "PENDING" }),
    prisma.draft.count({ where: { status: "APPROVED" } }),
    approvalStats(),
  ]);

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
              ? "O assistente escreve, você dá o OK. Nada sai sem a sua aprovação."
              : "Aprovação desligada: o assistente envia sozinho."}
          </p>
        </div>
      </header>

      <section className="sec">
        <div className="setting" style={{ padding: 0 }}>
          <span className="setting-text">
            <b>Aprovar antes de enviar</b>
            <small>
              {stats.decided === 0
                ? "Quando você aprovar as primeiras mensagens, mostro quantas o assistente acertou sem você mexer."
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
