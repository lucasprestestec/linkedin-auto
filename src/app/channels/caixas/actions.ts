"use server";

import { revalidatePath } from "next/cache";
import type { MailboxStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { parseEmail } from "@/lib/contactFields";
import { seal } from "@/lib/secretBox";
import { testServers } from "@/lib/email";
import { mailboxConfig } from "@/lib/mailboxes";

export interface MailboxInput {
  address: string;
  password: string;
  displayName: string;
  dailyLimit: number;
  smtpHost: string;
  smtpPort: number;
  imapHost: string;
  imapPort: number;
}

const host = (v: string) => v.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
const port = (v: number) => (Number.isInteger(v) && v > 0 && v < 65536 ? v : null);

// Cadastra uma caixa. Antes de guardar, confere se o envio e a leitura funcionam com os dados informados.
export async function addMailbox(data: MailboxInput): Promise<{ error?: string }> {
  await requireSession();
  const e = parseEmail(data.address);
  if ("error" in e) return { error: e.error };
  if (!e.email) return { error: "Informe o endereço da caixa." };
  if (!data.password) return { error: "Informe a senha da caixa (senha de app, se o provedor pedir)." };
  const smtpHost = host(data.smtpHost);
  const imapHost = host(data.imapHost);
  const smtpPort = port(data.smtpPort);
  const imapPort = port(data.imapPort);
  if (!smtpHost || !imapHost || !smtpPort || !imapPort) return { error: "Confira os servidores e as portas de envio e de leitura." };
  const dailyLimit = Math.min(100, Math.max(1, Math.round(data.dailyLimit) || 25));
  if (await prisma.mailbox.findUnique({ where: { address: e.email }, select: { id: true } })) return { error: "Essa caixa já está cadastrada." };

  const fields = {
    address: e.email,
    displayName: data.displayName.trim().slice(0, 60) || null,
    smtpHost,
    smtpPort,
    smtpSecure: smtpPort === 465,
    imapHost,
    imapPort,
    imapSecure: imapPort === 993,
    dailyLimit,
  };
  const problem = await testServers({
    address: fields.address,
    password: data.password,
    smtp: { host: smtpHost, port: smtpPort, secure: fields.smtpSecure },
    imap: { host: imapHost, port: imapPort, secure: fields.imapSecure },
  });
  if (problem) return { error: `Não consegui entrar nessa caixa. ${problem}` };

  await prisma.mailbox.create({ data: { ...fields, passwordEnc: seal(data.password) } });
  revalidatePath("/channels/caixas");
  revalidatePath("/channels");
  return {};
}

// Pausa (não envia, mas continua lendo as respostas), retoma ou aposenta a caixa. Aposentada fica no histórico.
export async function setMailboxStatus(id: string, status: MailboxStatus) {
  await requireSession();
  if (status !== "ACTIVE" && status !== "PAUSED" && status !== "RETIRED") return;
  await prisma.mailbox.update({ where: { id }, data: { status } });
  revalidatePath("/channels/caixas");
  revalidatePath("/channels");
}

export async function setMailboxLimit(id: string, dailyLimit: number) {
  await requireSession();
  await prisma.mailbox.update({ where: { id }, data: { dailyLimit: Math.min(100, Math.max(1, Math.round(dailyLimit) || 25)) } });
  revalidatePath("/channels/caixas");
}

// Confere a conexão da caixa agora.
export async function testMailbox(id: string): Promise<{ error?: string }> {
  await requireSession();
  const mb = await prisma.mailbox.findUnique({ where: { id } });
  if (!mb) return { error: "Caixa não encontrada." };
  const problem = await testServers(mailboxConfig(mb));
  await prisma.mailbox.update({ where: { id }, data: problem ? { lastError: problem.slice(0, 300), lastErrorAt: new Date() } : { lastError: null } });
  revalidatePath("/channels/caixas");
  return problem ? { error: problem } : {};
}
