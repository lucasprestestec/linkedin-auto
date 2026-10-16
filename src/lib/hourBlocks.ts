// Horas cheias do expediente de um dia, com a situação de cada uma para a tela Agenda:
// livre (o assistente pode oferecer), bloqueada por você (evento de bloqueio no Google) ou ocupada (compromisso).
// Só conta e data, sem Google: dá para testar (scripts/test-hour-blocks.ts).

export interface HourSlot {
  iso: string;
  label: string;
  state: "free" | "blocked" | "busy";
  blockId: string | null;
}

interface HourEvent {
  id: string;
  start: Date;
  end: Date;
  allDay: boolean;
  busy: boolean;
  blocked: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function hourSlotsFor(dayKey: string, workStartHour: number, workEndHour: number, events: HourEvent[], now: Date): HourSlot[] {
  const hours: HourSlot[] = [];
  for (let h = workStartHour; h < workEndHour; h++) {
    const start = new Date(`${dayKey}T${pad(h)}:00:00-03:00`).getTime();
    const end = start + 3_600_000;
    if (start <= now.getTime()) continue;
    const overlaps = events.filter((e) => !e.allDay && e.busy && e.start.getTime() < end && e.end.getTime() > start);
    const block = overlaps.find((e) => e.blocked);
    hours.push({ iso: new Date(start).toISOString(), label: `${h}h`, state: block ? "blocked" : overlaps.length ? "busy" : "free", blockId: block?.id ?? null });
  }
  return hours;
}
