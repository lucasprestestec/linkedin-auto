"use server";

import { revalidatePath } from "next/cache";
import type { MessageChannel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { readContacts, type ImportProblem, type ImportRow } from "@/lib/contactImport";
import { isExcluded, loadExclusionRules } from "@/lib/exclusion";
import { emailEnabled } from "@/lib/email";
import { deskcommConfig } from "@/lib/deskcomm";

export type ImportFirstContact = "ME" | "EMAIL" | "WHATSAPP";

export interface ImportResult {
  error?: string;
  total?: number;
  toCreate?: number;
  existing?: number;
  excluded?: number;
  invalid?: number;
  created?: number;
  ignored?: string[];
  problems?: ImportProblem[];
  sample?: { line: number; name: string; contact: string }[];
}

const MAX_TEXT = 2_000_000;
const MAX_PROBLEMS = 100;
const CHUNK = 500;

const contactOf = (r: ImportRow) => [r.email, r.phone && `+${r.phone}`, r.linkedinProfileUrl && "LinkedIn"].filter(Boolean).join(" · ");

// Confere (commit = false) ou importa (commit = true) uma planilha de contatos para uma campanha.
export async function importContacts(input: { text: string; campaignId: string; firstContact: ImportFirstContact; commit: boolean }): Promise<ImportResult> {
  await requireSession();
  if (input.text.length > MAX_TEXT) return { error: "O arquivo é grande demais (máximo de 2 MB). Divida em partes menores." };
  const parsed = readContacts(input.text);
  if (parsed.error) return { error: parsed.error, ignored: parsed.ignored };

  let maxLeads: number | null = null;
  if (input.campaignId) {
    const campaign = await prisma.campaign.findUnique({ where: { id: input.campaignId }, select: { status: true, maxLeads: true } });
    if (!campaign) return { error: "Campanha não encontrada." };
    if (campaign.status !== "ACTIVE") return { error: "Essa campanha está pausada ou finalizada." };
    maxLeads = campaign.maxLeads;
  }

  // Quem já está no sistema (mesmo e-mail, telefone ou LinkedIn) não duplica.
  const emails = parsed.rows.flatMap((r) => (r.email ? [r.email] : []));
  const phones = parsed.rows.flatMap((r) => (r.phone ? [r.phone] : []));
  const links = parsed.rows.flatMap((r) => (r.linkedinProfileUrl ? [r.linkedinProfileUrl] : []));
  const haveEmail = new Set<string>();
  const havePhone = new Set<string>();
  const haveLink = new Set<string>();
  for (let i = 0; i < emails.length; i += CHUNK) {
    const found = await prisma.lead.findMany({ where: { email: { in: emails.slice(i, i + CHUNK), mode: "insensitive" } }, select: { email: true } });
    for (const l of found) if (l.email) haveEmail.add(l.email.toLowerCase());
  }
  for (let i = 0; i < phones.length; i += CHUNK) {
    const found = await prisma.lead.findMany({ where: { phone: { in: phones.slice(i, i + CHUNK) } }, select: { phone: true } });
    for (const l of found) if (l.phone) havePhone.add(l.phone);
  }
  for (let i = 0; i < links.length; i += CHUNK) {
    const found = await prisma.lead.findMany({ where: { linkedinProfileUrl: { in: links.slice(i, i + CHUNK) } }, select: { linkedinProfileUrl: true } });
    for (const l of found) if (l.linkedinProfileUrl) haveLink.add(l.linkedinProfileUrl);
  }
  const rules = await loadExclusionRules();

  const problems = [...parsed.problems];
  const fresh: ImportRow[] = [];
  let existing = 0;
  let excluded = 0;
  for (const r of parsed.rows) {
    if ((r.email && haveEmail.has(r.email)) || (r.phone && havePhone.has(r.phone)) || (r.linkedinProfileUrl && haveLink.has(r.linkedinProfileUrl))) {
      existing++;
      problems.push({ line: r.line, message: "Já está no sistema." });
    } else if (isExcluded({ linkedinProfileUrl: r.linkedinProfileUrl, firstName: r.firstName, lastName: r.lastName, headline: r.jobTitle }, rules)) {
      excluded++;
      problems.push({ line: r.line, message: "Está na lista de quem nunca contatar (Conta)." });
    } else fresh.push(r);
  }
  problems.sort((a, b) => a.line - b.line);

  const summary: ImportResult = {
    total: parsed.total,
    toCreate: fresh.length,
    existing,
    excluded,
    invalid: parsed.problems.length,
    ignored: parsed.ignored,
    problems: problems.slice(0, MAX_PROBLEMS),
    sample: fresh.slice(0, 5).map((r) => ({ line: r.line, name: [r.firstName, r.lastName].filter(Boolean).join(" "), contact: contactOf(r) })),
  };
  if (!input.commit) return summary;

  if (fresh.length === 0) return { ...summary, error: "Nenhum contato novo para importar." };
  if (input.firstContact === "EMAIL" && !(await emailEnabled())) return { ...summary, error: "Para o assistente se apresentar por e-mail, conecte o e-mail em Canais ou cadastre caixas de envio." };
  if (input.firstContact === "WHATSAPP" && !(await deskcommConfig())) return { ...summary, error: "Para o assistente falar pelo WhatsApp, conecte o WhatsApp em Canais." };
  if (input.campaignId && maxLeads != null) {
    const inCampaign = await prisma.lead.count({ where: { campaignId: input.campaignId } });
    if (inCampaign + fresh.length > maxLeads) return { ...summary, error: `A campanha aceita no máximo ${maxLeads} pessoas e já tem ${inCampaign}. Faltam vagas para ${fresh.length}.` };
  }

  let created = 0;
  for (let i = 0; i < fresh.length; i += CHUNK) {
    const r = await prisma.lead.createMany({
      skipDuplicates: true,
      data: fresh.slice(i, i + CHUNK).map((row) => {
        // O primeiro contato só vale se a pessoa tem aquele canal na planilha.
        const channel: MessageChannel | null = input.firstContact === "EMAIL" && row.email ? "EMAIL" : input.firstContact === "WHATSAPP" && row.phone ? "WHATSAPP" : null;
        return {
          firstName: row.firstName,
          lastName: row.lastName,
          jobTitle: row.jobTitle,
          email: row.email,
          phone: row.phone,
          linkedinProfileUrl: row.linkedinProfileUrl,
          referredBy: row.referredBy,
          kind: row.kind,
          personal: row.personal,
          campaignId: input.campaignId || null,
          status: "NEW" as const,
          firstContactChannel: channel,
          nextStep: channel
            ? `O assistente vai se apresentar por ${channel === "EMAIL" ? "e-mail" : "WhatsApp"} no próximo horário de trabalho.`
            : "Importado de planilha. Você começa a conversa quando quiser; depois o assistente acompanha.",
        };
      }),
    });
    created += r.count;
  }
  revalidatePath("/conversations");
  revalidatePath("/campaigns");
  revalidatePath("/");
  return { ...summary, created };
}
