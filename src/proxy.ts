import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, isValidSessionToken } from "@/lib/auth";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rotas chamadas por serviços externos (cron-job.org, edges.run) não têm
  // cookie de sessão: cada uma confere o próprio segredo.
  if (
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/api/webhooks/") ||
    // Imagem de abertura dos e-mails: carregada pelo app de e-mail do cliente.
    pathname.startsWith("/api/o/") ||
    pathname === "/login" ||
    pathname.startsWith("/_next")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!isValidSessionToken(token)) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|manifest.webmanifest|favicon.ico|sw.js).*)"],
};
