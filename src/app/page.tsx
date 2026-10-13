import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatSlot } from "@/lib/slots";
import { clockTime } from "@/lib/format";
import { getConversationItems } from "@/lib/conversations";
import { MobileHeader } from "@/components/MobileHeader";
import { ConversationList } from "@/components/ConversationList";
import { IconCalendar, IconFlame, IconMessages, IconPlus, IconUserPlus } from "@/components/Icons";
import { dailyReport } from "@/lib/dailyReport";
import { deskcommConfigOf } from "@/lib/deskcomm";
import { AutomationBar } from "./AutomationBar";
import { linkedinDataCount } from "./settings/actions";

export const dynamic = "force-dynamic";

// Tela principal: o assistente (liga/desliga), os números do dia numa faixa fina e a lista de conversas
// (por situação, em cores, ou em quadro). Substitui as antigas telas Início e Conversas.
export default async function HomePage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const status = typeof params.status === "string" ? params.status : "";

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

  const linkedinOk = Boolean(settings.linkedinIdentityId) && !settings.linkedinNeedsReconnect;
  // O assistente pode rodar só com WhatsApp: o botão de ligar não pode depender do LinkedIn.
  const whatsappOk = Boolean(deskcommConfigOf(settings));
  const leftover = settings.linkedinIdentityId ? 0 : await linkedinDataCount();
  const sentToday = report.sent.LINKEDIN + report.sent.EMAIL + report.sent.WHATSAPP;

  const steps = [
    { done: Boolean(settings.ownerName?.trim()), label: "Cadastrar o seu nome (o assistente se apresenta com ele)", href: "/settings" },
    { done: linkedinOk || whatsappOk, label: "Conectar um canal (LinkedIn ou WhatsApp)", href: "/channels" },
    { done: Boolean(settings.targetAudience?.trim()), label: "Dizer quem você quer alcançar", href: "/settings#alcance" },
    { done: conversations.length > 0, label: "Adicionar as primeiras pessoas", href: "/prospect" },
  ];
  const pending = steps.filter((s) => !s.done);
  const meetingName = [nextMeeting?.firstName, nextMeeting?.lastName].filter(Boolean).join(" ") || "um contato";

  const stats = [
    { value: contacted, label: "contatados", Icon: IconUserPlus, tone: "tone-accent" },
    { value: replied, label: "responderam", Icon: IconMessages, tone: "tone-ok" },
    { value: qualified, label: "oportunidades", Icon: IconFlame, tone: "tone-warn" },
    { value: meetingCount, label: "reuniões", Icon: IconCalendar, tone: "tone-violet" },
  ];

  return (
    <main className="page">
      <MobileHeader />

      <div className="cv-top">
        <h1 className="cv-title">Conversas</h1>
        <AutomationBar
          paused={settings.automationPaused}
          connected={linkedinOk || whatsappOk}
          hasName={Boolean(settings.ownerName?.trim())}
          today={`${sentToday} mensage${sentToday !== 1 ? "ns" : "m"} hoje`}
        />
      </div>

      <div className="cv-stats" aria-label="Resumo">
        {stats.map(({ value, label, Icon, tone }) => (
          <span key={label} className="cv-stat">
            <span className={`ico-chip ${tone}`} style={{ width: 22, height: 22, borderRadius: 7 }}>
              <Icon size={13} />
            </span>
            <b>{value}</b>
            {label}
          </span>
        ))}
        <Link href="/contacts/new" className="cv-add">
          <IconPlus size={14} />
          Contato
        </Link>
      </div>

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

      {pending.length > 0 && (
        <details className="cv-setup">
          <summary>
            <span>
              Para começar: {pending.length === 1 ? "falta 1 passo" : `faltam ${pending.length} passos`}
            </span>
          </summary>
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
        </details>
      )}

      <ConversationList key={`${q}|${status}`} items={conversations} initialQuery={q} initialGroup={status} />

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
