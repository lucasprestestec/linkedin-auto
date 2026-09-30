import { prisma } from "@/lib/prisma";
import { open, seal } from "@/lib/secretBox";

// "Entrar com Google": o corretor autoriza o sistema a enviar e ler e-mails da
// conta dele, sem passar senha. Tudo pela API REST do Gmail (grátis).
//
// Configuração (uma vez, pelo dono do sistema — não pelo cliente):
//   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET — credenciais OAuth de um projeto no
//   Google Cloud, com a Gmail API ativada e o redirecionamento
//   <APP_URL>/api/email/google/callback autorizado.

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  // Google Agenda: ver os horários livres e criar a reuniao (com link do Meet).
  "https://www.googleapis.com/auth/calendar.events",
];
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleRedirectUri(origin: string): string {
  return `${(process.env.APP_URL || origin).replace(/\/$/, "")}/api/email/google/callback`;
}

export function googleAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    // offline + consent: garante o refresh token, pra funcionar sem o corretor logado.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      ...body,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    const err = new Error(json.error_description || json.error || `Google respondeu ${res.status}`) as Error & { code?: string };
    err.code = json.error;
    throw err;
  }
  return json;
}

// Troca o código do login pelo refresh token e grava a conexão.
export async function connectGoogle(code: string, redirectUri: string): Promise<string> {
  const tokens = await tokenRequest({ code, redirect_uri: redirectUri, grant_type: "authorization_code" });
  if (!tokens.refresh_token) throw new Error("O Google não devolveu a autorização permanente. Tente conectar de novo.");
  const profile = await gmailFetch<{ emailAddress: string; historyId: string }>("/profile", tokens.access_token!);
  await prisma.settings.update({
    where: { id: "singleton" },
    data: { googleEmail: profile.emailAddress.toLowerCase(), googleRefreshToken: seal(tokens.refresh_token),
      googleHistoryId: profile.historyId,
      // O corretor pode desmarcar a agenda na tela do Google: so vale se o escopo veio.
      googleCalendarEnabled: (tokens.scope ?? "").split(" ").includes(CALENDAR_SCOPE),
    },
  });
  cached = null;
  return profile.emailAddress;
}

export async function disconnectGoogle() {
  const s = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" }, select: { googleRefreshToken: true } });
  if (s.googleRefreshToken) {
    // Revoga no Google também; se falhar, o corretor ainda pode remover em myaccount.google.com.
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(open(s.googleRefreshToken))}`, { method: "POST" }).catch(() => {});
  }
  await prisma.settings.update({ where: { id: "singleton" }, data: { googleEmail: null, googleRefreshToken: null, googleHistoryId: null, googleCalendarEnabled: false } });
  cached = null;
}

let cached: { token: string; expires: number } | null = null;

export async function googleAccessToken(): Promise<string> {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const s = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" }, select: { googleRefreshToken: true } });
  if (!s.googleRefreshToken) throw new Error("E-mail do Google não conectado.");
  try {
    const t = await tokenRequest({ refresh_token: open(s.googleRefreshToken), grant_type: "refresh_token" });
    cached = { token: t.access_token!, expires: Date.now() + (t.expires_in ?? 3600) * 1000 };
    return cached.token;
  } catch (err) {
    // invalid_grant: o corretor revogou o acesso ou trocou a senha — precisa reconectar.
    if ((err as { code?: string }).code === "invalid_grant") {
      await prisma.settings.update({ where: { id: "singleton" }, data: { googleRefreshToken: null } });
      throw new Error("A conexão com o Google expirou. Conecte o e-mail de novo em Conta.");
    }
    throw err;
  }
}

async function gmailFetch<T>(path: string, token?: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token ?? (await googleAccessToken())}`, "content-type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    const err = new Error(body.error?.message || `Gmail respondeu ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

export async function gmailSend(raw: Buffer, threadId?: string | null): Promise<{ id: string; threadId: string; messageId: string | null }> {
  const sent = await gmailFetch<{ id: string; threadId: string }>("/messages/send", undefined, {
    method: "POST",
    body: JSON.stringify({ raw: raw.toString("base64url"), ...(threadId ? { threadId } : {}) }),
  });
  // O Message-ID final (é ele que volta no "In-Reply-To" da resposta do cliente).
  const meta = await gmailFetch<{ payload?: { headers?: { name: string; value: string }[] } }>(
    `/messages/${sent.id}?format=metadata&metadataHeaders=Message-ID`,
  ).catch(() => null);
  const messageId = meta?.payload?.headers?.find((h) => h.name.toLowerCase() === "message-id")?.value ?? null;
  return { ...sent, messageId };
}

// Mensagens que entraram na caixa de entrada desde a última leitura. Na
// primeira vez (ou se o ponteiro for antigo demais), só marca a posição.
export async function gmailNewInboxMessages(): Promise<{ id: string; threadId: string; raw: Buffer }[]> {
  const s = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" }, select: { googleHistoryId: true } });
  const markNow = async () => {
    const p = await gmailFetch<{ historyId: string }>("/profile");
    await prisma.settings.update({ where: { id: "singleton" }, data: { googleHistoryId: p.historyId } });
  };
  if (!s.googleHistoryId) {
    await markNow();
    return [];
  }

  const ids = new Map<string, string>();
  let pageToken: string | undefined;
  let latest = s.googleHistoryId;
  try {
    do {
      const q = new URLSearchParams({ startHistoryId: s.googleHistoryId, historyTypes: "messageAdded", labelId: "INBOX", ...(pageToken ? { pageToken } : {}) });
      const page = await gmailFetch<{ history?: { messagesAdded?: { message: { id: string; threadId: string; labelIds?: string[] } }[] }[]; historyId: string; nextPageToken?: string }>(
        `/history?${q}`,
      );
      for (const h of page.history ?? [])
        for (const a of h.messagesAdded ?? []) {
          // Rascunhos e enviados por nós não interessam.
          if (a.message.labelIds?.includes("SENT") || a.message.labelIds?.includes("DRAFT")) continue;
          ids.set(a.message.id, a.message.threadId);
        }
      latest = page.historyId;
      pageToken = page.nextPageToken;
    } while (pageToken);
  } catch (err) {
    // 404: histórico expirou (caixa sem leitura por muito tempo) — recomeça daqui.
    if ((err as { status?: number }).status === 404) {
      await markNow();
      return [];
    }
    throw err;
  }

  const out: { id: string; threadId: string; raw: Buffer }[] = [];
  for (const [id, threadId] of ids) {
    const m = await gmailFetch<{ raw: string }>(`/messages/${id}?format=raw`);
    out.push({ id, threadId, raw: Buffer.from(m.raw, "base64url") });
  }
  await prisma.settings.update({ where: { id: "singleton" }, data: { googleHistoryId: latest } });
  return out;
}

export async function gmailCheck(): Promise<void> {
  await gmailFetch("/profile");
}
