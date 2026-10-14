import Link from "next/link";
import type { MailboxStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MobileHeader } from "@/components/MobileHeader";
import { Help } from "@/components/Help";
import { effectiveLimit } from "@/lib/mailboxPolicy";
import { sentTodayByMailbox } from "@/lib/mailboxes";
import { MailboxForm } from "./MailboxForm";
import { MailboxActions } from "./MailboxActions";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<MailboxStatus, string> = { ACTIVE: "Ativa", PAUSED: "Pausada", RETIRED: "Aposentada" };

const dateBR = (d: Date) => d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

// Caixas de envio da prospecção: o sistema gira entre elas e respeita o limite de cada uma por dia.
export default async function MailboxesPage() {
  const now = new Date();
  const [boxes, today, sentRows, replyRows] = await Promise.all([
    prisma.mailbox.findMany({ orderBy: [{ status: "asc" }, { createdAt: "asc" }] }),
    sentTodayByMailbox(now),
    prisma.message.groupBy({ by: ["mailboxId"], where: { channel: "EMAIL", sender: { not: "LEAD" }, mailboxId: { not: null } }, _count: { _all: true } }),
    prisma.message.groupBy({ by: ["mailboxId"], where: { channel: "EMAIL", sender: "LEAD", mailboxId: { not: null } }, _count: { _all: true } }),
  ]);
  const sent = new Map(sentRows.map((r) => [r.mailboxId as string, r._count._all]));
  const replies = new Map(replyRows.map((r) => [r.mailboxId as string, r._count._all]));
  const active = boxes.filter((b) => b.status === "ACTIVE");
  const room = active.reduce((n, b) => n + Math.max(0, effectiveLimit(b, now) - (today.get(b.id) ?? 0)), 0);

  return (
    <main className="page">
      <MobileHeader />
      <Link href="/channels" className="btn-text" style={{ alignSelf: "flex-start" }}>
        ← Canais
      </Link>
      <header className="p-head">
        <div>
          <h1 className="t-title">
            Caixas de envio{" "}
            <Help>
              Para mandar muitos e-mails sem queimar a reputação, o sistema divide o envio entre várias caixas. Cada caixa tem um limite por dia que sobe aos poucos.
              Quem já conversa com uma caixa continua nela. As respostas chegam aqui, na conversa da pessoa. Quando o endereço de alguém não existe, o sistema para de
              insistir nele.
            </Help>
          </h1>
          <p className="t-sub">
            {active.length === 0
              ? "Nenhuma caixa ativa: o e-mail sai pela caixa única conectada em Canais."
              : `${active.length} ${active.length === 1 ? "caixa ativa" : "caixas ativas"} · ainda cabem ${room} e-mails novos hoje.`}
          </p>
        </div>
      </header>

      {boxes.length > 0 && (
        <ul className="list">
          {boxes.map((b) => {
            const limit = effectiveLimit(b, now);
            const usedToday = today.get(b.id) ?? 0;
            const total = sent.get(b.id) ?? 0;
            const answered = replies.get(b.id) ?? 0;
            return (
              <li key={b.id}>
                <div className="item">
                  <div className="item-main">
                    <span className="item-title">
                      {b.address} · {STATUS_LABEL[b.status]}
                    </span>
                    <span className="item-sub">
                      {b.status === "ACTIVE" ? `Hoje: ${usedToday} de ${limit}${limit < b.dailyLimit ? ` (sobe até ${b.dailyLimit})` : ""} · ` : ""}
                      {total} enviados · {answered} respostas · {b.bounces} devolvidos
                    </span>
                    {b.lastError && (
                      <span className="field-error">
                        Problema{b.lastErrorAt ? ` em ${dateBR(b.lastErrorAt)}` : ""}: {b.lastError}
                      </span>
                    )}
                  </div>
                  <MailboxActions id={b.id} status={b.status} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <section className="sec">
        <MailboxForm />
      </section>
    </main>
  );
}
