// O Gmail (e alguns filtros de segurança) carrega a imagem de rastreio sozinho, segundos depois da
// entrega, sem ninguém ter aberto o e-mail (medido: 2 a 6 s). Uma abertura tão colada no envio não
// vale como abertura da pessoa. Isto continua sendo estimativa: o Apple Mail e filtros lentos
// carregam a imagem depois disso e ainda contam.
export const AUTO_OPEN_SECONDS = 60;

export function isAutoOpen(sentAt: Date | null | undefined, now: Date): boolean {
  if (!sentAt) return false;
  return now.getTime() - sentAt.getTime() < AUTO_OPEN_SECONDS * 1000;
}
