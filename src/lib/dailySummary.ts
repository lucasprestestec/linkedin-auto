import type { Settings } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendPush } from "@/lib/push";
import { emailConnection, sendEmail } from "@/lib/email";
import { localDayKey, localHourAndWeekday } from "@/lib/schedule";
import { firstNameOf } from "@/lib/shell";
import { dailyReport, reportHeadline, reportText } from "@/lib/dailyReport";

// Resumo do dia: uma vez por dia, quando o expediente acaba (workEndHour, fuso
// de SP), vai um push pro celular e — se houver e-mail conectado — um e-mail
// pra própria caixa do corretor. Dia sem nenhuma novidade não gera aviso.
export async function maybeSendDailySummary(settings: Settings, now = new Date()): Promise<{ sent: boolean; push?: number; email?: boolean; reason?: string }> {
  if (!settings.dailySummaryEnabled) return { sent: false, reason: "desligado" };
  const { hour, weekday } = localHourAndWeekday(now);
  if (settings.workWeekdaysOnly && (weekday === 0 || weekday === 6)) return { sent: false, reason: "fim de semana" };
  if (hour < settings.workEndHour) return { sent: false, reason: "expediente ainda aberto" };
  const today = localDayKey(now);
  if (settings.dailySummarySentOn === today) return { sent: false, reason: "já enviado hoje" };

  // Marca antes de enviar: se algo falhar no meio, não repete a cada rodada.
  await prisma.settings.update({ where: { id: "singleton" }, data: { dailySummarySentOn: today } });

  const report = await dailyReport();
  const quiet =
    !report.invites && !report.accepted && !report.sent.LINKEDIN && !report.sent.EMAIL && !report.sent.WHATSAPP && !report.replies.length && !report.opens.length && !report.needYou.length;
  if (quiet) return { sent: false, reason: "dia sem novidades" };

  const headline = reportHeadline(report);
  const push = await sendPush({ title: "Resumo do dia", body: headline, url: "/", tag: "daily-summary" });

  let email = false;
  const conn = await emailConnection().catch(() => null);
  if (conn) {
    try {
      const date = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
      await sendEmail({
        to: conn.address,
        subject: `Resumo do dia ${date} — ${headline}`,
        text: reportText(report, firstNameOf(settings.ownerName), process.env.APP_URL ?? null),
      });
      email = true;
    } catch (err) {
      console.error("Falha ao enviar o resumo do dia por e-mail", err);
    }
  }
  return { sent: true, push, email };
}
