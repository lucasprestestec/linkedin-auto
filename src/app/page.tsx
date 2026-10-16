import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { clockTime, todayLabel } from "@/lib/format";
import { getConversationItems, type ConvItem } from "@/lib/conversations";
import { loadApprovalItems } from "@/lib/approvalItems";
import { MobileHeader } from "@/components/MobileHeader";
import { Avatar } from "@/components/Avatar";
import { ChannelBadge, type ChannelKey } from "@/components/ChannelBadge";
import { IconAlert, IconArrowRight, IconChevronRight } from "@/components/Icons";
import { dailyReport } from "@/lib/dailyReport";
import { deskcommConfigOf } from "@/lib/deskcomm";
import { emailEnabled } from "@/lib/email";
import { emailsSentToday, messagesSentToday, whatsappSentToday } from "@/lib/limits";
import { emailLeftToday } from "@/lib/mailboxes";
import { remainingDailyInviteQuota } from "@/lib/prospect";
import { ApprovalCard } from "./approvals/ApprovalCard";
import { AutomationBar } from "./AutomationBar";
import { linkedinDataCount } from "./settings/actions";

export const dynamic = "force-dynamic";

const TZ = "America/Sao_Paulo";

// Número do painel de partidas: um quadrinho por algarismo.
function Flaps({ value }: { value: number }) {
  return (
    <span className="flaps" aria-label={String(value)}>
      {String(value).split("").map((d, i) => (
        <span key={i} className="flap" aria-hidden="true">
          {d}
        </span>
      ))}
    </span>
  );
}

const HOT_TAG: Partial<Record<ConvItem["status"], { label: string; cls: string }>> = {
  NEEDS_HUMAN: { label: "Com você", cls: "tg-you" },
  MEETING_SCHEDULED: { label: "Reunião", cls: "tg-ok" },
  QUALIFIED: { label: "Oportunidade", cls: "tg-ok" },
  CONVERSATION_OPEN: { label: "Conversando", cls: "tg-ok" },
};

function fullName(c: { firstName: string | null; lastName: string | null }) {
  return [c.firstName, c.lastName].filter(Boolean).join(" ") || "Contato";
}

// Tela Hoje: o que precisa de você (aprovar, responder, consertar), o painel de números e como o dia está indo.
export default async function TodayPage() {
  const now = new Date();
  const outbound = { some: { sender: { in: ["AGENT" as const, "HUMAN" as const] } } };
  const [settings, conversations, drafts, report, meetingCount, nextMeeting, contacted, replied, qualified, emailOn, invitesLeft, liSent, emSent, waSent] = await Promise.all([
    prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } }),
    getConversationItems(),
    loadApprovalItems({ status: "PENDING" }),
    dailyReport(),
    prisma.lead.count({ where: { meetingAt: { gte: now } } }),
    prisma.lead.findFirst({ where: { meetingAt: { gte: now } }, orderBy: { meetingAt: "asc" }, select: { id: true, firstName: true, lastName: true, jobTitle: true, meetingAt: true, meetingLink: true } }),
    prisma.lead.count({ where: { messages: outbound } }),
    prisma.lead.count({ where: { AND: [{ messages: outbound }, { messages: { some: { sender: "LEAD" } } }] } }),
    prisma.lead.count({ where: { status: "QUALIFIED" } }),
    emailEnabled(),
    remainingDailyInviteQuota(),
    messagesSentToday(),
    emailsSentToday(),
    whatsappSentToday(),
  ]);

  const linkedinOk = Boolean(settings.linkedinIdentityId) && !settings.linkedinNeedsReconnect;
  // O assistente pode rodar só com WhatsApp: o botão de ligar não pode depender do LinkedIn.
  const whatsappOk = Boolean(deskcommConfigOf(settings));
  const [leftover, emailLeft] = await Promise.all([settings.linkedinIdentityId ? 0 : linkedinDataCount(), emailOn ? emailLeftToday(settings) : 0]);
  const sentToday = report.sent.LINKEDIN + report.sent.EMAIL + report.sent.WHATSAPP;

  const steps = [
    { done: Boolean(settings.ownerName?.trim()), label: "Cadastrar o seu nome (o assistente se apresenta com ele)", href: "/settings" },
    { done: linkedinOk || whatsappOk, label: "Conectar um canal (LinkedIn ou WhatsApp)", href: "/channels" },
    { done: Boolean(settings.targetAudience?.trim()), label: "Dizer quem você quer alcançar", href: "/settings#alcance" },
    { done: conversations.length > 0, label: "Adicionar as primeiras pessoas", href: "/prospect" },
  ];
  const pending = steps.filter((s) => !s.done);

  const needYou = conversations.filter((c) => c.status === "NEEDS_HUMAN").sort((a, b) => b.whenTs - a.whenTs);
  const alerts = [
    settings.linkedinNeedsReconnect && { key: "li", title: "Seu LinkedIn saiu do ar", sub: whatsappOk || emailOn ? "o assistente segue pelos outros canais" : "o assistente parou de abordar", href: "/channels", cta: "Reconectar", tag: "Parado" },
    leftover > 0 && { key: "old", title: `${leftover} ${leftover > 1 ? "conversas" : "conversa"} de um LinkedIn desconectado`, sub: "você decide se guarda ou apaga", href: "/channels", cta: "Ver", tag: "Aviso" },
  ].filter((a): a is { key: string; title: string; sub: string; href: string; cta: string; tag: string } => Boolean(a));
  const waiting = alerts.length + needYou.length + drafts.length;

  const hot = conversations
    .filter((c) => HOT_TAG[c.status])
    .sort((a, b) => b.whenTs - a.whenTs)
    .slice(0, 3);

  const capacity = [
    linkedinOk && { key: "LINKEDIN" as ChannelKey, label: "Convites", used: settings.dailyInviteLimit - invitesLeft, limit: settings.dailyInviteLimit },
    linkedinOk && { key: "LINKEDIN" as ChannelKey, label: "LinkedIn", used: liSent, limit: settings.dailyMessageLimit },
    emailOn && { key: "EMAIL" as ChannelKey, label: "E-mail", used: emSent, limit: emSent + emailLeft },
    whatsappOk && { key: "WHATSAPP" as ChannelKey, label: "WhatsApp", used: waSent, limit: settings.dailyWhatsappLimit },
  ].filter((c): c is { key: ChannelKey; label: string; used: number; limit: number } => Boolean(c));

  const rate = contacted ? Math.round((replied / contacted) * 100) : 0;
  const board = [
    { label: "Contatados", value: contacted, note: <><b>+{report.invites}</b> convites hoje</> },
    { label: "Responderam", value: replied, note: <><b>{rate}%</b> de resposta</> },
    { label: "Oportunidades", value: qualified, note: "mostraram interesse", hot: true },
    { label: "Reuniões", value: meetingCount, note: "marcadas na agenda" },
    { label: "Hoje", value: sentToday, note: "mensagens enviadas" },
  ];

  const meetDay = nextMeeting?.meetingAt;

  return (
    <main className="page page-wide" style={{ "--c": "var(--a-hoje)" } as React.CSSProperties}>
      <MobileHeader />

      <header className="area-head">
        <div className="grow">
          <h1 className="area-title">
            <i className="area-sq" aria-hidden="true" />
            Hoje
          </h1>
          <p className="area-sub">{todayLabel()}. O que precisa de você e como estão os números.</p>
        </div>
        <AutomationBar
          paused={settings.automationPaused}
          connected={linkedinOk || whatsappOk}
          hasName={Boolean(settings.ownerName?.trim())}
          today={`${sentToday} mensage${sentToday !== 1 ? "ns enviadas" : "m enviada"} hoje`}
        />
      </header>

      {pending.length > 0 && (
        <details className="setup">
          <summary>
            <span className="setup-bar" aria-hidden="true">
              <i style={{ width: `${((steps.length - pending.length) / steps.length) * 100}%` }} />
            </span>
            Para começar: {pending.length === 1 ? "falta 1 passo" : `faltam ${pending.length} passos`}
            <IconChevronRight size={16} />
          </summary>
          <ol className="checklist">
            {steps.map((s) => (
              <li key={s.label} className={s.done ? "ok" : undefined}>
                <Link href={s.href}>{s.label}</Link>
              </li>
            ))}
          </ol>
        </details>
      )}

      <section className="board" aria-label="Números">
        {board.map((b) => (
          <div key={b.label} className={`board-col${b.hot ? " hot" : ""}`}>
            <span className="board-lbl">{b.label}</span>
            <Flaps value={b.value} />
            <span className="board-note">{b.note}</span>
          </div>
        ))}
        <div className="board-foot">
          <span>Desde o início · hoje desde 0h</span>
          <span>Atualizado às {clockTime(now)}</span>
        </div>
      </section>

      <div className="split">
        <section aria-labelledby="h-wait">
          <h2 className="h2" id="h-wait">
            Aguardando você {waiting > 0 && <span className="count">{waiting}</span>}
          </h2>
          {waiting === 0 ? (
            <p className="done-note">Nada esperando por você agora. O assistente segue trabalhando.</p>
          ) : (
            <div className="queue">
              {alerts.map((a) => (
                <article key={a.key} className="q">
                  <span className="q-ico stop" aria-hidden="true">
                    <IconAlert size={20} />
                  </span>
                  <div className="q-body">
                    <p className="q-title">
                      {a.title} <span>· {a.sub}</span>
                    </p>
                    <div className="q-act">
                      <Link href={a.href} className="btn-solid">
                        {a.cta}
                      </Link>
                    </div>
                    <p className="q-meta">
                      <span className={`tg ${a.tag === "Parado" ? "tg-stop" : "tg-you"}`}>{a.tag}</span>
                    </p>
                  </div>
                </article>
              ))}
              {needYou.map((c) => (
                <article key={c.id} className="q">
                  <Avatar firstName={c.firstName} lastName={c.lastName} photoUrl={c.avatarUrl} channel={c.channel} size={44} />
                  <div className="q-body">
                    <p className="q-title">
                      {fullName(c)} <span>· {c.needsHumanReason ?? "o assistente passou a conversa para você"}</span>
                    </p>
                    <div className="q-act">
                      <Link href={`/leads/${c.id}`} className="btn-solid">
                        Abrir conversa
                      </Link>
                    </div>
                    <p className="q-meta">
                      <span className="tg tg-blue">Sua vez</span>
                      {c.when}
                    </p>
                  </div>
                </article>
              ))}
              {drafts.map((d) => (
                <ApprovalCard key={d.id} item={d} />
              ))}
            </div>
          )}

          {report.timeline.length > 0 && (
            <details className="log">
              <summary>
                <IconChevronRight size={16} />O que o assistente fez hoje ({report.timeline.length})
              </summary>
              <ol className="timeline">
                {report.timeline.slice(0, 30).map((t, i) => (
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
        </section>

        <aside className="side-col" aria-label="Resumo do dia">
          <section className="panel">
            <h2 className="panel-h">Próxima reunião</h2>
            {nextMeeting && meetDay ? (
              <Link href={`/leads/${nextMeeting.id}`} className="meet">
                <span className="cal" aria-hidden="true">
                  <b>{meetDay.toLocaleDateString("pt-BR", { weekday: "short", timeZone: TZ }).replace(".", "")}</b>
                  <span>{meetDay.toLocaleDateString("pt-BR", { day: "numeric", timeZone: TZ })}</span>
                </span>
                <span>
                  <b>{fullName(nextMeeting)}</b> · {clockTime(meetDay)}
                  {nextMeeting.jobTitle && <small>{nextMeeting.jobTitle}</small>}
                </span>
              </Link>
            ) : (
              <p className="muted small">Nenhuma reunião marcada.</p>
            )}
          </section>

          {hot.length > 0 && (
            <section className="panel">
              <h2 className="panel-h">Mais quentes</h2>
              <ul className="hot">
                {hot.map((c) => (
                  <li key={c.id}>
                    <Link href={`/leads/${c.id}`}>
                      <Avatar firstName={c.firstName} lastName={c.lastName} photoUrl={c.avatarUrl} size={32} />
                      <span className="grow">
                        {fullName(c)}
                        <small>{c.when}</small>
                      </span>
                      <span className={`tg ${HOT_TAG[c.status]!.cls}`}>{HOT_TAG[c.status]!.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {capacity.length > 0 && (
            <section className="panel">
              <h2 className="panel-h">Quanto ainda cabe hoje</h2>
              {capacity.map((c) => (
                <div key={c.label} className="cap-row">
                  <span className="row" style={{ gap: 6 }}>
                    <ChannelBadge channel={c.key} size={16} />
                    {c.label}
                  </span>
                  <span className={`tape${c.used >= c.limit ? " full" : ""}`} aria-hidden="true">
                    <i style={{ width: `${c.limit ? Math.min(100, (c.used / c.limit) * 100) : 0}%` }} />
                  </span>
                  <small>
                    {c.used}/{c.limit}
                  </small>
                </div>
              ))}
              <Link href="/prospect" className="link-arrow">
                Adicionar pessoas <IconArrowRight size={16} />
              </Link>
            </section>
          )}

          <p className="cap-note">
            <Link href="/approvals">{settings.approvalMode ? "Aprovação ligada: nada sai sem o seu OK." : "Aprovação desligada."} Ajustar</Link>
          </p>
        </aside>
      </div>
    </main>
  );
}
