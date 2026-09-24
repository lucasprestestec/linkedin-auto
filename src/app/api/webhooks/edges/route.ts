import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Recebe dois tipos de evento da edges.run, configurados no dashboard dela
// (Developer Settings > Webhooks), ambos POST na mesma URL:
//
// 1. Ciclo de vida da integração do LinkedIn (event_type: "integration") — usado
//    para detectar quando a sessão do LinkedIn cai (AUTH_EXPIRED/AUTH_FAILED) e
//    avisar o corretor em vez de deixar os convites/mensagens falhando em silêncio.
// 2. Resultado de um convite agendado em modo async (linkedin-connect-profile) —
//    um callback por perfil, ver lib/discover.ts.
//
// A edges.run permite configurar até 10 headers customizados enviados em toda
// chamada de webhook; EDGES_WEBHOOK_SECRET precisa estar configurado lá como um
// desses headers (ex.: X-Webhook-Secret) para essa rota aceitar a chamada.
export async function POST(request: Request) {
  const secret = process.env.EDGES_WEBHOOK_SECRET;
  if (secret && request.headers.get("x-webhook-secret") !== secret) {
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
    // cria lead. O corretor não vê um lead "morto" na lista; o próximo ciclo de
    // busca (lib/discover.ts) pode reencontrar o mesmo perfil e tentar de novo.
    console.error("Convite não concluído:", profileUrl, payload.error?.error_label);
    return;
  }

  const [firstName, ...rest] = (payload.custom_data?.full_name ?? "").split(" ");
  await prisma.lead.upsert({
    where: { linkedinProfileUrl: profileUrl },
    update: {},
    create: {
      linkedinProfileUrl: profileUrl,
      firstName: firstName || null,
      lastName: rest.join(" ") || null,
      jobTitle: payload.custom_data?.job_title ?? null,
      status: "INVITE_SENT",
    },
  });
}
