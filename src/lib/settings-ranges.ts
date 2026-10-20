// Faixas aceitas nos ajustes de follow-up. Usadas pelos formulários (limites
// do stepper) e pelas server actions (validação) — mesma fonte nos dois lados.
export const FOLLOW_UP_MAX_COUNT_RANGE = [0, 10] as const;
// Intervalo entre follow-ups, em dias (guardado em horas no banco).
export const FOLLOW_UP_DELAY_DAYS_RANGE = [1, 30] as const;

export function validFollowUp(count: number, delayHours: number): boolean {
  const [minC, maxC] = FOLLOW_UP_MAX_COUNT_RANGE;
  const [minD, maxD] = FOLLOW_UP_DELAY_DAYS_RANGE;
  return (
    Number.isInteger(count) &&
    Number.isInteger(delayHours) &&
    count >= minC &&
    count <= maxC &&
    delayHours >= minD * 24 &&
    delayHours <= maxD * 24 &&
    delayHours % 24 === 0
  );
}

// E-mails por dia do cliente (limite geral do canal). O que realmente sai ainda é limitado pelas caixas
// (cada uma com o próprio aquecimento e teto), então este número só precisa acompanhar o maior plano:
// o Escala, com 9.900 e-mails por mês, são uns 450 por dia útil.
export const EMAIL_DAILY_RANGE = [1, 600] as const;
