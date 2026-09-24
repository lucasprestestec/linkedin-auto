import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { secretMatches } from "@/lib/auth";
import { findLeadByProfileUrl } from "@/lib/leads";
import { normalizeLinkedinUrl } from "@/lib/linkedin";

// Recebe dois tipos de evento da edges.run, configurados no dashboard dela
// (Developer Settings > Webhooks), ambos POST na mesma URL:
//
// 1. Ciclo de vida da integração do LinkedIn (event_type: "integration") — usado
//    para detectar quando a sessão do LinkedIn cai (AUTH_EXPIRED/AUTH_FAILED) e
//    avisar o corretor em vez de deixar os convites/mensagens falhando em silêncio.
// 2. Resultado de um convite agendado em modo async (linkedin-connect-profile) —
//    um callback por perfil, ver lib/prospect.ts (inviteProspects).
//
// A edges.run permite configurar até 10 headers customizados enviados em toda
// chamada de webhook; EDGES_WEBHOOK_SECRET precisa estar configurado lá como um
// desses headers (ex.: X-Webhook-Secret) para essa rota aceitar a chamada.
// Sem o segredo configurado a rota recusa tudo: ela fica fora do login do
// painel (a edges.run não tem sessão), então o segredo é a única proteção.
export async function POST(request: Request) {
  if (!secretMatches(request.headers.get("x-webhook-secret"), process.env.EDGES_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const payload = await request.json();

  if (payload.event_type === "integration") {
    await handleIntegrationEvent(payload);
    return NextResponse.json({ ok: true });
  }

  if (payload.run) {
    await handleConnectCallback(payload);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true, ignored: true });
}

async function handleIntegrationEvent(payload: {
  event: string;
  data?: { reason?: string | null };
}) {
  if (payload.event === "AUTH_EXPIRED" || payload.event === "AUTH_FAILED") {
    // Pausa a automação: sem sessão válida, convite/mensagem só falhariam repetido.
    // Não retomamos sozinhos no AUTH_SUCCESS — quem liga de volta é o corretor,
    // pelo mesmo botão que ele já usa pra pausar/retomar manualmente.
    await prisma.settings.update({
      where: { id: "singleton" },
      data: {
        linkedinNeedsReconnect: true,
        linkedinReconnectReason: payload.data?.reason ?? "Sessão do LinkedIn expirou",
        automationPaused: true,
      },
    });
  } else if (payload.event === "AUTH_SUCCESS") {
    await prisma.settings.update({
      where: { id: "singleton" },
      data: { linkedinNeedsReconnect: false, linkedinReconnectReason: null },
    });
  }
}

async function handleConnectCallback(payload: {
  run: { status: string };
  input?: { linkedin_profile_url?: string } | null;
  custom_data?: { full_name?: string; job_title?: string } | null;
  error?: { error_label?: string } | null;
}) {
  const profileUrl = payload.input?.linkedin_profile_url;
  if (!profileUrl) return;

  if (payload.run.status !== "SUCCEEDED") {
    // Convite não confirmado (limite, já conectado, perfil inacessível, etc.) — não
    // cria lead. O corretor não vê um lead "morto" na lista; pode colar o mesmo
    // link de novo na Prospecção depois pra tentar outra vez.
    console.error("Convite não concluído:", profileUrl, payload.error?.error_label);
    return;
  }

  // O lead pode já existir com a URL escrita de outro jeito (ex.: criado pelo
  // cron a partir de uma conversa) — procura pelo perfil, não pela string exata.
  if (await findLeadByProfileUrl(profileUrl)) return;

  const [firstName, ...rest] = (payload.custom_data?.full_name ?? "").split(" ");
  try {
    await prisma.lead.create({
      data: {
        linkedinProfileUrl: normalizeLinkedinUrl(profileUrl) ?? profileUrl,
        firstName: firstName || null,
        lastName: rest.join(" ") || null,
        jobTitle: payload.custom_data?.job_title ?? null,
        status: "INVITE_SENT",
        invitedAt: new Date(),
      },
    });
  } catch (err) {
    // Callback repetido chegando ao mesmo tempo: o outro já criou o lead.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return;
    throw err;
  }
}
