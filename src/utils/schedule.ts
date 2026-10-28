/**
 * Programação semanal: em que dia da semana cai cada dia da ficha.
 *
 * Convenção usada em todo o app: 0 = segunda-feira … 6 = domingo.
 * É a semana como o brasileiro lê um calendário de treino — o
 * `Date.getDay()` do JavaScript (0 = domingo) é convertido aqui e
 * em nenhum outro lugar.
 */

export const WEEKDAY_NAMES = [
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
  'Domingo',
] as const;

export const WEEKDAY_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const;

/** Posição do dia na semana começando na segunda (0–6). */
export function weekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/** As 7 datas da semana de `reference`, de segunda a domingo, à meia-noite local. */
export function weekDates(reference: Date = new Date()): Date[] {
  const monday = new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate() - weekdayIndex(reference),
  );
  return Array.from(
    { length: 7 },
    (_, index) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index),
  );
}

/** Date → 'YYYY-MM-DD' no fuso local, comparável com as datas do ciclo. */
export function toDateOnly(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "Segunda-feira, 26/10/2026" */
export function formatWeekdayDate(date: Date): string {
  const formatted = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${WEEKDAY_NAMES[weekdayIndex(date)]}, ${formatted}`;
}

/** [0, 2, 4] → "Seg, Qua, Sex" */
export function describeWeekdays(weekdays: readonly number[]): string {
  return [...weekdays]
    .sort((a, b) => a - b)
    .map((index) => WEEKDAY_SHORT[index])
    .join(', ');
}

/**
 * Limpa o que vem do banco: só inteiros de 0 a 6, sem repetição, em
 * ordem. Fichas criadas antes da programação semanal não têm o campo.
 */
export function normalizeWeekdays(values: unknown): number[] {
  if (!Array.isArray(values)) return [];
  const valid = values.filter(
    (value): value is number => Number.isInteger(value) && value >= 0 && value <= 6,
  );
  return [...new Set(valid)].sort((a, b) => a - b);
}

/**
 * Distribuição padrão por quantidade de dias na divisão, com folga
 * entre treinos sempre que possível: 3 dias → seg, qua, sex.
 */
const DEFAULT_SPREAD: Record<number, number[]> = {
  1: [0],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 3, 4],
  6: [0, 1, 2, 3, 4, 5],
  7: [0, 1, 2, 3, 4, 5, 6],
};

/** Dia(s) da semana sugeridos para o `index`-ésimo dia de uma divisão de `dayCount` dias. */
export function defaultWeekdays(dayCount: number, index: number): number[] {
  const weekday = DEFAULT_SPREAD[dayCount]?.[index];
  return weekday === undefined ? [] : [weekday];
}

/**
 * Programação da semana: para cada dia (segunda a domingo), o dia da
 * ficha que cai nele, ou null para descanso.
 *
 * Fichas antigas, sem nenhum dia da semana definido, recebem a
 * distribuição padrão pela ordem da divisão — a home nunca fica
 * vazia só porque a ficha é anterior a esta funcionalidade.
 */
export function buildWeekSchedule<T extends { weekdays: readonly number[]; day_order: number }>(
  days: readonly T[],
): (T | null)[] {
  const ordered = [...days].sort((a, b) => a.day_order - b.day_order);
  const week: (T | null)[] = [null, null, null, null, null, null, null];
  const hasExplicit = ordered.some((day) => day.weekdays.length > 0);

  ordered.forEach((day, index) => {
    const weekdays = hasExplicit ? day.weekdays : defaultWeekdays(ordered.length, index);
    for (const weekday of weekdays) {
      // Se dois dias disputarem o mesmo dia da semana (dado antigo),
      // vence o primeiro da divisão.
      if (week[weekday] === null) week[weekday] = day;
    }
  });

  return week;
}
