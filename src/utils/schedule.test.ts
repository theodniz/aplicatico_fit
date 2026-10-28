import {
  buildWeekSchedule,
  defaultWeekdays,
  describeWeekdays,
  formatWeekdayDate,
  normalizeWeekdays,
  toDateOnly,
  weekDates,
  weekdayIndex,
} from './schedule';

describe('weekdayIndex', () => {
  it('começa a semana na segunda', () => {
    expect(weekdayIndex(new Date(2026, 9, 26))).toBe(0); // segunda, 26/10/2026
    expect(weekdayIndex(new Date(2026, 9, 31))).toBe(5); // sábado
    expect(weekdayIndex(new Date(2026, 10, 1))).toBe(6); // domingo
  });
});

describe('weekDates', () => {
  it('devolve de segunda a domingo da semana da data', () => {
    const dates = weekDates(new Date(2026, 9, 29, 18, 30)); // quinta à tarde
    expect(dates.map(toDateOnly)).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
  });

  it('domingo pertence à semana que começou na segunda anterior', () => {
    expect(toDateOnly(weekDates(new Date(2026, 10, 1))[0] as Date)).toBe('2026-10-26');
  });
});

describe('formatWeekdayDate', () => {
  it('escreve o dia da semana e a data completa', () => {
    expect(formatWeekdayDate(new Date(2026, 9, 26))).toBe('Segunda-feira, 26/10/2026');
  });
});

describe('describeWeekdays', () => {
  it('lista os dias em ordem, abreviados', () => {
    expect(describeWeekdays([4, 0, 2])).toBe('Seg, Qua, Sex');
  });
});

describe('normalizeWeekdays', () => {
  it('aceita só inteiros de 0 a 6, sem repetição', () => {
    expect(normalizeWeekdays([3, 1, 3, 7, -1, 2.5, 'x'])).toEqual([1, 3]);
  });

  it('trata o campo ausente de fichas antigas', () => {
    expect(normalizeWeekdays(undefined)).toEqual([]);
  });
});

describe('defaultWeekdays', () => {
  it('espalha a divisão pela semana', () => {
    expect([0, 1, 2].map((index) => defaultWeekdays(3, index))).toEqual([[0], [2], [4]]);
  });

  it('não programa nada além de 7 dias', () => {
    expect(defaultWeekdays(8, 0)).toEqual([]);
  });
});

describe('buildWeekSchedule', () => {
  const day = (id: string, day_order: number, weekdays: number[]) => ({ id, day_order, weekdays });

  it('coloca cada dia da ficha nos dias da semana escolhidos', () => {
    const week = buildWeekSchedule([day('a', 1, [0, 3]), day('b', 2, [1, 4])]);
    expect(week.map((item) => item?.id ?? null)).toEqual(['a', 'b', null, 'a', 'b', null, null]);
  });

  it('ficha sem dias da semana recebe a distribuição padrão', () => {
    const week = buildWeekSchedule([day('b', 2, []), day('a', 1, []), day('c', 3, [])]);
    expect(week.map((item) => item?.id ?? null)).toEqual(['a', null, 'b', null, 'c', null, null]);
  });

  it('com algum dia programado, os sem programação ficam de fora', () => {
    const week = buildWeekSchedule([day('a', 1, [2]), day('b', 2, [])]);
    expect(week.map((item) => item?.id ?? null)).toEqual([null, null, 'a', null, null, null, null]);
  });

  it('em conflito, vence o primeiro da divisão', () => {
    const week = buildWeekSchedule([day('b', 2, [0]), day('a', 1, [0])]);
    expect(week[0]?.id).toBe('a');
  });
});
