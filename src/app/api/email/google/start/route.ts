import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { googleAuthUrl, googleConfigured, googleRedirectUri } from "@/lib/gmail";

const STATE_COOKIE = "google_oauth_state";

// Botão "Conectar com Google" (Conta): manda o corretor pra tela de login do
// Google. O "state" num cookie garante que o retorno veio deste clique.
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  if (!googleConfigured()) return NextResponse.redirect(new URL("/settings?email=nao-configurado#email", origin));
  const state = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(googleAuthUrl(googleRedirectUri(origin), state));
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/email/google",
    maxAge: 60 * 10,
  });
  return res;
}
