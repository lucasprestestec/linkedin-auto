// Faixas aceitas nos ajustes de follow-up. Usadas pelo formulário (limites do
// stepper) e pela server action (validação) — mesma fonte nos dois lados.
export const FOLLOW_UP_MAX_COUNT_RANGE = [0, 5] as const;
export const FOLLOW_UP_DELAY_HOURS_RANGE = [12, 336] as const;
export const FOLLOW_UP_DELAY_STEP_HOURS = 12;
