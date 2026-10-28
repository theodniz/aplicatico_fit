import {
  addDaysToInputValue,
  computeProgress,
  computeStatus,
  describeRemaining,
  formatDateOnly,
  formatPeriod,
  parseDateOnly,
  suggestNextDayId,
  todayAsInputValue,
} from './cycle';

/**
 * Testes da lógica de ciclo.
 *
 * Duas armadilhas justificam esta suíte:
 *
 * 1. FUSO HORÁRIO — `new Date('2026-08-01')` é meia-noite UTC, que
 *    no Brasil (UTC-3) cai em 31/07 às 21h. Sem tratamento, um ciclo
 *    apareceria começando um dia antes e um ciclo que termina hoje
 *    seria dado como expirado.
 *
 * 2. BORDAS — o primeiro e o último dia precisam contar como
 *    ativos, e o intervalo é inclusivo nas duas pontas.
 *
 * O relógio é congelado para os testes não quebrarem conforme a
 * data real avança.
 */

/** Congela "hoje" em 15/08/2026, meio-dia no horário local. */
function freezeToday() {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 7, 15, 12, 0, 0));
}

beforeEach(freezeToday);
afterEach(() => jest.useRealTimers());

const cycle = (start: string, end: string, completed: string | null = null) => ({
  start_date: start,
  end_date: end,
  completed_at: completed,
});

describe('parseDateOnly', () => {
  it('interpreta a data no fuso local, não em UTC', () => {
    const date = parseDateOnly('2026-08-01');
    expect(date.getFullYear()).toBe(2026);
    // getMonth() é zero-based: 7 = agosto.
    expect(date.getMonth()).toBe(7);
    // O ponto do teste: precisa ser dia 1, e não 31 de julho.
    expect(date.getDate()).toBe(1);
  });
});

describe('computeStatus', () => {
  it('classifica ciclo futuro como upcoming', () => {
    expect(computeStatus(cycle('2026-09-01', '2026-09-30'))).toBe('upcoming');
  });

  it('classifica ciclo corrente como active', () => {
    expect(computeStatus(cycle('2026-08-01', '2026-09-30'))).toBe('active');
  });

  it('classifica ciclo vencido como expired', () => {
    expect(computeStatus(cycle('2026-06-01', '2026-07-31'))).toBe('expired');
  });

  it('encerramento manual vence a data', () => {
    // Dentro do período, mas encerrado à mão: completed, não active.
    expect(computeStatus(cycle('2026-08-01', '2026-09-30', '2026-08-10T10:00:00Z'))).toBe(
      'completed',
    );
    // Já vencido e encerrado à mão: continua completed.
    expect(computeStatus(cycle('2026-06-01', '2026-07-31', '2026-07-20T10:00:00Z'))).toBe(
      'completed',
    );
  });

  it('conta o primeiro e o último dia como ativos', () => {
    expect(computeStatus(cycle('2026-08-15', '2026-09-30'))).toBe('active');
    expect(computeStatus(cycle('2026-07-01', '2026-08-15'))).toBe('active');
  });

  it('vira expired no dia seguinte ao término', () => {
    expect(computeStatus(cycle('2026-07-01', '2026-08-14'))).toBe('expired');
  });

  it('vira active no primeiro dia, não antes', () => {
    expect(computeStatus(cycle('2026-08-16', '2026-09-30'))).toBe('upcoming');
  });
});

describe('computeProgress', () => {
  it('conta o total de dias incluindo as duas pontas', () => {
    // 01/08 a 30/09 = 31 + 30 = 61 dias.
    expect(computeProgress(cycle('2026-08-01', '2026-09-30')).totalDays).toBe(61);
  });

  it('trata um ciclo de um dia como duração 1, não 0', () => {
    expect(computeProgress(cycle('2026-08-15', '2026-08-15')).totalDays).toBe(1);
  });

  it('calcula dias decorridos e restantes', () => {
    // De 01/08 a 15/08 são 14 dias decorridos; faltam 46 até 30/09.
    const progress = computeProgress(cycle('2026-08-01', '2026-09-30'));
    expect(progress.elapsedDays).toBe(14);
    expect(progress.remainingDays).toBe(46);
  });

  it('não passa de 100% em ciclo vencido', () => {
    const progress = computeProgress(cycle('2026-06-01', '2026-06-30'));
    expect(progress.percent).toBe(100);
    expect(progress.elapsedDays).toBe(progress.totalDays);
    // Restante nunca é negativo, mesmo muito depois do fim.
    expect(progress.remainingDays).toBe(0);
  });

  it('não fica negativo em ciclo futuro', () => {
    const progress = computeProgress(cycle('2026-09-01', '2026-09-30'));
    expect(progress.elapsedDays).toBe(0);
    expect(progress.percent).toBe(0);
  });
});

describe('describeRemaining', () => {
  it('descreve o tempo restante de um ciclo ativo', () => {
    expect(describeRemaining(cycle('2026-08-01', '2026-09-30'), 'active')).toBe(
      '46 dias restantes',
    );
  });

  it('evita "1 dias" e "0 dias"', () => {
    expect(describeRemaining(cycle('2026-08-01', '2026-08-16'), 'active')).toBe('1 dia restante');
    expect(describeRemaining(cycle('2026-08-01', '2026-08-15'), 'active')).toBe('Último dia');
  });

  it('descreve quando um ciclo futuro começa', () => {
    expect(describeRemaining(cycle('2026-08-15', '2026-09-30'), 'upcoming')).toBe('Começa hoje');
    expect(describeRemaining(cycle('2026-08-16', '2026-09-30'), 'upcoming')).toBe('Começa amanhã');
    expect(describeRemaining(cycle('2026-08-25', '2026-09-30'), 'upcoming')).toBe(
      'Começa em 10 dias',
    );
  });

  it('descreve ciclos finalizados', () => {
    expect(describeRemaining(cycle('2026-06-01', '2026-07-31'), 'expired')).toBe(
      'Período encerrado',
    );
    expect(describeRemaining(cycle('2026-08-01', '2026-09-30', '2026-08-10'), 'completed')).toBe(
      'Ciclo encerrado',
    );
  });
});

describe('suggestNextDayId', () => {
  const days = [
    { id: 'd1', day_order: 1 },
    { id: 'd2', day_order: 2 },
    { id: 'd3', day_order: 3 },
  ];

  it('sugere o primeiro dia quando nunca treinou', () => {
    expect(suggestNextDayId(days, null)).toBe('d1');
  });

  it('sugere o dia seguinte ao último treinado', () => {
    expect(suggestNextDayId(days, 'd1')).toBe('d2');
    expect(suggestNextDayId(days, 'd2')).toBe('d3');
  });

  it('volta ao primeiro dia depois do último', () => {
    // O ponto da divisão: terminou o Dia 3, recomeça no Dia 1.
    expect(suggestNextDayId(days, 'd3')).toBe('d1');
  });

  it('usa a ordem do dia, não a ordem do array', () => {
    const shuffled = [
      { id: 'd3', day_order: 3 },
      { id: 'd1', day_order: 1 },
      { id: 'd2', day_order: 2 },
    ];
    expect(suggestNextDayId(shuffled, 'd1')).toBe('d2');
    expect(suggestNextDayId(shuffled, 'd3')).toBe('d1');
  });

  it('recomeça do início se o último dia foi excluído da ficha', () => {
    expect(suggestNextDayId(days, 'dia-que-nao-existe-mais')).toBe('d1');
  });

  it('devolve null quando a ficha não tem dias', () => {
    expect(suggestNextDayId([], null)).toBeNull();
    expect(suggestNextDayId([], 'd1')).toBeNull();
  });

  it('sugere o próprio dia quando a divisão tem só um', () => {
    const single = [{ id: 'unico', day_order: 1 }];
    expect(suggestNextDayId(single, 'unico')).toBe('unico');
  });
});

describe('formatação', () => {
  it('formata data no padrão brasileiro sem deslocar o dia', () => {
    expect(formatDateOnly('2026-08-01')).toBe('01/08/2026');
    expect(formatDateOnly('2026-12-31')).toBe('31/12/2026');
  });

  it('formata o período do ciclo', () => {
    expect(formatPeriod(cycle('2026-08-01', '2026-09-30'))).toBe('01/08/2026 → 30/09/2026');
  });

  it('devolve hoje no formato aceito por <input type="date">', () => {
    expect(todayAsInputValue()).toBe('2026-08-15');
  });

  it('soma dias respeitando a virada de mês', () => {
    expect(addDaysToInputValue('2026-08-15', 59)).toBe('2026-10-13');
    expect(addDaysToInputValue('2026-08-31', 1)).toBe('2026-09-01');
    // Ano bissexto: 2028 tem 29 de fevereiro.
    expect(addDaysToInputValue('2028-02-28', 1)).toBe('2028-02-29');
  });
});
