import { isValidBearer } from "@/lib/auth";

// Endpoints de operação (/api/ops/*): quem chama é a central local do dono, nunca uma pessoa no navegador.
// Sem tela e sem sessão: valem só com o segredo do robô (CRON_SECRET) no cabeçalho Authorization.
export function opsAuthorized(request: Request): boolean {
  return isValidBearer(request.headers.get("authorization"), process.env.CRON_SECRET);
}
