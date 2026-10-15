// Endereço dos links que vão dentro dos e-mails (pixel de abertura e "não quero mais receber").
// TRACKING_URL é um endereço próprio (ex.: https://links.seudominio.com) apontando para este mesmo
// sistema; sem ele, usa o APP_URL como antes. O APP_URL continua servindo ao login, convites e áudios.
const clean = (v: string | undefined) => v?.trim().replace(/\/$/, "") || null;

export function trackingBase(): string | null {
  return clean(process.env.TRACKING_URL) ?? clean(process.env.APP_URL);
}
