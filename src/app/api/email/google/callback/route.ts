import { NextResponse, type NextRequest } from "next/server";
import { connectGoogle, googleRedirectUri } from "@/lib/gmail";
import { secretMatches } from "@/lib/auth";

const STATE_COOKIE = "google_oauth_state";

// Volta do login do Google: confere o state, troca o código pelo acesso e
// devolve o corretor pra Conta com o resultado.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const back = (result: string) => {
    const res = NextResponse.redirect(new URL(`/channels?email=${result}#email`, url.origin));
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/email/google" });
    return res;
  };

  if (url.searchParams.get("error")) return back("cancelado");
  const code = url.searchParams.get("code");
  if (!code || !secretMatches(url.searchParams.get("state"), request.cookies.get(STATE_COOKIE)?.value)) return back("expirou");

  try {
    await connectGoogle(code, googleRedirectUri(url.origin));
    return back("conectado");
  } catch (err) {
    console.error("Falha ao conectar o Google", err);
    return back("falhou");
  }
}
