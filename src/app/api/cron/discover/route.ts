import { NextResponse } from "next/server";
import { discoverAndInviteLeads } from "@/lib/discover";

// Agendador externo (cron-job.org) chama essa rota 1x/dia para buscar prospects
// novos e agendar convite para eles.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await discoverAndInviteLeads();
  return NextResponse.json(result);
}
