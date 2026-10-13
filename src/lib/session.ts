import { cookies } from "next/headers";
import { COOKIE_NAME, isValidSessionToken } from "@/lib/auth";

// As ações de servidor aceitam POST direto (não só pela tela). O proxy.ts já barra quem não
// entrou, mas a documentação do Next pede conferir de novo dentro de cada ação.
export async function requireSession(): Promise<void> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!isValidSessionToken(token)) throw new Error("Sessão expirada. Entre de novo.");
}
