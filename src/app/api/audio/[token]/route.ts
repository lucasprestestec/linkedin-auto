import { loadOutgoingAudio } from "@/lib/voice/outgoingAudio";

export const dynamic = "force-dynamic";

// Endereço público do áudio que vai por WhatsApp: o Deskcomm baixa daqui. O código é longo e impossível
// de adivinhar, e o arquivo some em 24 horas (ver outgoingAudio.ts). Fora do porteiro de login (proxy.ts).
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const audio = await loadOutgoingAudio(token);
  if (!audio) return new Response("Não encontrado.", { status: 404 });
  return new Response(new Uint8Array(audio.bytes), {
    status: 200,
    headers: {
      "content-type": audio.mime,
      "content-length": String(audio.bytes.length),
      "cache-control": "private, max-age=300",
      "x-content-type-options": "nosniff",
    },
  });
}
