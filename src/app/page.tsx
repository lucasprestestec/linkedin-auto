import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatSlot } from "@/lib/slots";
import { greeting, clockTime } from "@/lib/format";
import { firstNameOf } from "@/lib/shell";
import { getConversationItems } from "@/lib/conversations";
import { MobileHeader } from "@/components/MobileHeader";
import { Avatar } from "@/components/Avatar";
import { IconCalendar, IconFlame, IconMessages, IconUserPlus } from "@/components/Icons";
import { dailyReport } from "@/lib/dailyReport";
import { deskcommConfigOf } from "@/lib/deskcomm";
import { AutomationBar } from "./AutomationBar";
import { linkedinDataCount } from "./settings/actions";

export const dynamic = "force-dynamic";

const NEED_LIMIT = 4;

export default async function HomePage() {
  const now = new Date();
  const outbound = { some: { sender: { in: ["AGENT" as const, "HUMAN" as const] } } };
  const [settings, conversations, report, draftCount, meetingCount, nextMeeting, contacted, replied, qualified] = await Promise.all([
    prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } }),
    getConversationItems(),
    dailyReport(),
    prisma.draft.count({ where: { status: "PENDING" } }),
    prisma.lead.count({ where: { meetingAt: { gte: now } } }),
    prisma.lead.findFirst({ where: { meetingAt: { gte: now } }, orderBy: { meetingAt: "asc" }, select: { firstName: true, lastName: true, meetingAt: true } }),
    prisma.lead.count({ where: { messages: outbound } }),
    prisma.lead.count({ where: { AND: [{ messages: outbound }, { messages: { some: { sender: "LEAD" } } }] } }),
    prisma.lead.count({ where: { status: "QUALIFIED" } }),
  ]);

  const name = firstNameOf(settings.ownerName);
  const linkedinOk = Boolean(settings.linkedinIdentityId) && !settings.linkedinNeedsReconnect;
  // O assistente pode rodar só com WhatsApp: o botão de ligar não pode depender do LinkedIn.
  const whatsappOk = Boolean(deskcommConfigOf(settings));
  const leftover = settings.linkedinIdentityId ? 0 : await linkedinDataCount();
  const sentToday = report.sent.LINKEDIN + report.sent.EMAIL + report.sent.WHATSAPP;

  // Precisa de você: quem a IA passou pra você e quem respondeu e ainda espera resposta.
  const needYou = conversations
    .filter((c) => c.status === "NEEDS_HUMAN" || (c.unanswered && c.status !== "LOST"))
    .sort((a, b) => Number(b.status === "NEEDS_HUMAN") - Number(a.status === "NEEDS_HUMAN") || b.whenTs - a.whenTs);

  const steps = [
    { done: Boolean(settings.ownerName?.trim()), label: "Cadastrar o seu nome (o assistente se apresenta com ele)", href: "/settings" },
    { done: linkedinOk, label: "Conectar o LinkedIn", href: "/channels" },
    { done: Boolean(settings.targetAudience?.trim()), label: "Dizer quem você quer alcançar", href: "/settings#alcance" },
    { done: conversations.length > 0, label: "Adicionar as primeiras pessoas", href: "/prospect" },
  ];
  const setupDone = steps.every((s) => s.done);
  const meetingName = [nextMeeting?.firstName, nextMeeting?.lastName].filter(Boolean).join(" ") || "um contato";

  const stats = [
    { value: contacted, label: "Contatados", Icon: IconUserPlus, tone: "ico-accent" },
    { value: replied, label: "Responderam", Icon: IconMessages, tone: "ico-ok" },
    { value: qualified, label: "Oportunidades", Icon: IconFlame, tone: "ico-warn" },
    { value: meetingCount, label: "Reuniões marcadas", Icon: IconCalendar, tone: "ico-violet" },
  ];

  return (
    <main className="page">
      <MobileHeader />

      <header className="p-head">
        <div>
          <p className="t-sub" style={{ margin: 0 }}>
            {greeting()}
            {name ? `, ${name}` : ""}
          </p>
          <h1 className="t-title">Início</h1>
        </div>
      </header>

      <section className="h-hero">
        <div>
          <p>{needYou.length === 1 ? "conversa espera por você" : "conversas esperam por você"}</p>
          <b>{needYou.length}</b>
        </div>
        <Link href={needYou.length ? "/conversations?status=urgent" : "/conversations"} className="btn-hero">
          {needYou.length ? "Ver conversas" : "Abrir conversas"}
        </Link>
      </section>

      {(settings.linkedinNeedsReconnect || leftover > 0 || draftCount > 0 || nextMeeting?.meetingAt) && (
        <div className="h-notes">
          {settings.linkedinNeedsReconnect && (
            <Link href="/channels" className="h-note">
              <i className="dot dot-danger" />
              Sua conta do LinkedIn saiu do ar.
              <span className="h-go">Reconectar</span>
            </Link>
          )}
          {leftover > 0 && (
            <Link href="/channels" className="h-note">
              <i className="dot" />
              {leftover} {leftover > 1 ? "conversas" : "conversa"} de um LinkedIn desconectado.
              <span className="h-go">Ver</span>
            </Link>
          )}
          {draftCount > 0 && (
            <Link href="/approvals" className="h-note">
              <i className="dot dot-warn" />
              {draftCount} mensage{draftCount > 1 ? "ns esperam" : "m espera"} sua aprovação.
              <span className="h-go">Revisar</span>
            </Link>
          )}
          {nextMeeting?.meetingAt && (
            <Link href="/agenda" className="h-note">
              <i className="dot dot-ok" />
              Próxima reunião: {meetingName}, {formatSlot(nextMeeting.meetingAt)}.
              <span className="h-go">Ver</span>
            </Link>
          )}
        </div>
      )}

      <div className="h-stats">
        {stats.map(({ value, label, Icon, tone }) => (
          <div key={label} className="h-stat">
            <span className={`ico ${tone}`}>
              <Icon size={18} />
            </span>
            <b>{value}</b>
            <span>{label}</span>
          </div>
        ))}
      </div>

      {!setupDone && (
        <section className="sec">
          <h2 className="t-label">Para começar</h2>
          <ol className="h-steps">
            {steps.map((s) => (
              <li key={s.label}>
                <Link href={s.href} className={s.done ? "done" : undefined}>
                  <span className="tick">{s.done ? "✓" : ""}</span>
                  {s.label}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="sec">
        <div className="sec-head">
          <h2 className="t-label">Precisa de você</h2>
          {needYou.length > NEED_LIMIT && (
            <Link href="/conversations?status=urgent" className="btn-text">
              Ver todas
            </Link>
          )}
        </div>
        {needYou.length === 0 ? (
          <p className="empty">Ninguém esperando resposta sua.</p>
        ) : (
          <ul className="list">
            {needYou.slice(0, NEED_LIMIT).map((c) => (
              <li key={c.id}>
                <Link href={`/leads/${c.id}`} className="item">
                  <Avatar firstName={c.firstName} lastName={c.lastName} size={40} />
                  <span className="item-main">
                    <span className="item-title">{[c.firstName, c.lastName].filter(Boolean).join(" ") || "Contato"}</span>
                    <span className="item-sub">{c.status === "NEEDS_HUMAN" && c.needsHumanReason ? c.needsHumanReason : (c.lastMessage?.content ?? "")}</span>
                  </span>
                  <span className="item-meta">{c.when}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="sec">
        <AutomationBar
          paused={settings.automationPaused}
          connected={linkedinOk || whatsappOk}
          hasName={Boolean(settings.ownerName?.trim())}
          today={`${sentToday} mensage${sentToday !== 1 ? "ns" : "m"} hoje`}
        />
      </section>

      {report.timeline.length > 0 && (
        <details className="sec h-fold">
          <summary>O que foi feito hoje ({report.timeline.length})</summary>
          <ol className="h-log">
            {report.timeline.slice(0, 12).map((t, i) => (
              <li key={`${t.kind}-${t.leadId}-${i}`}>
                <time>{clockTime(t.at)}</time>
                <Link href={t.kind === "invite" && t.name.endsWith("pessoas") ? "/campaigns" : `/leads/${t.leadId}`}>
                  <b>{t.name}</b> {t.text}
                </Link>
              </li>
            ))}
          </ol>
        </details>
      )}
    </main>
  );
}
