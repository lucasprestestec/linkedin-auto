import type { Settings } from "@prisma/client";

// Horário comercial do corretor (fuso de São Paulo). Mensagem automática às 3h
// da manhã denuncia robô e arrisca a conta — fora da janela, nada sai sozinho.
const TIME_ZONE = "America/Sao_Paulo";

export function localHourAndWeekday(now = new Date()): { hour: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "numeric", hourCycle: "h23", weekday: "short" }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const weekdayName = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekdayName);
  return { hour, weekday };
}

export function isWithinWorkHours(
  settings: Pick<Settings, "workStartHour" | "workEndHour" | "workWeekdaysOnly">,
  now = new Date(),
): boolean {
  const { hour, weekday } = localHourAndWeekday(now);
  if (settings.workWeekdaysOnly && (weekday === 0 || weekday === 6)) return false;
  return hour >= settings.workStartHour && hour < settings.workEndHour;
}
