import webpush from "web-push";
import { prisma } from "@/lib/prisma";

// Web Push: notificação no celular/computador do corretor quando um lead passa
// pra ele. Padrão do navegador (VAPID), sem serviço pago. Sem as chaves no
// ambiente, simplesmente não notifica.

function configured(): boolean {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:contato@example.com", publicKey, privateKey);
  return true;
}

export function pushPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

export async function sendPush(payload: { title: string; body: string; url: string; tag?: string }): Promise<number> {
  if (!configured()) return 0;
  const subscriptions = await prisma.pushSubscription.findMany();
  let delivered = 0;
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), {
          TTL: 60 * 60 * 24,
        });
        delivered++;
      } catch (err) {
        // 404/410: o navegador cancelou a inscrição — limpa pra não tentar de novo.
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        else console.error("Falha ao enviar push", status, err);
      }
    }),
  );
  return delivered;
}
