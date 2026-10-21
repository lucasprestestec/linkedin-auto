import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, isValidSessionToken } from "@/lib/auth";
import { sessionStillValid } from "@/lib/sessionCheck";

// O layout precisa saber a página atual para mandar quem perdeu o acesso de volta ao login.
function pass(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-path", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rotas chamadas por serviços externos (cron-job.org, edges.run) não têm
  // cookie de sessão: cada uma confere o próprio segredo.
  if (
    pathname.startsWith("/api/cron/") ||
    // Operações da central do dono (segredo próprio no cabeçalho): sem cookie de sessão.
    pathname.startsWith("/api/ops/") ||
    pathname.startsWith("/api/webhooks/") ||
    // Imagem de abertura dos e-mails: carregada pelo app de e-mail do cliente.
    pathname.startsWith("/api/o/") ||
    // "Não quero mais receber" do rodapé dos e-mails: vale só com o código assinado.
    pathname.startsWith("/api/u/") ||
    // Áudio que vai por WhatsApp: o Deskcomm baixa daqui (código impossível de adivinhar, vence em 24 h).
    pathname.startsWith("/api/audio/") ||
    // Formulário público de captação (link e QR Code de uma campanha): quem preenche não tem login.
    pathname.startsWith("/c/") ||
    pathname === "/login" ||
    // Convite de acesso: a pessoa ainda não tem senha. O código é assinado e vale uma vez.
    pathname.startsWith("/convite/") ||
    // Páginas públicas exigidas pelo Google na tela de consentimento do OAuth.
    pathname === "/sobre" ||
    pathname === "/privacidade" ||
    pathname === "/termos" ||
    pathname.startsWith("/_next")
  ) {
    return pass(request);
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  // Assinatura ok E a pessoa ainda ativa (desativada ou com senha trocada perde o acesso em todas as páginas e rotas).
  if (!isValidSessionToken(token) || !(await sessionStillValid(token!).catch(() => false))) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return pass(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|manifest.webmanifest|favicon.ico|sw.js).*)"],
};
