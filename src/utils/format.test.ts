import {
  elapsedSeconds,
  formatClock,
  formatDuration,
  formatRelativeDay,
  formatRest,
  formatWeight,
} from './format';

/**
 * O relógio é congelado: sem isso, "ontem" e "há 3 dias" mudariam
 * de resultado conforme a data real avança e os testes quebrariam
 * sozinhos.
 */
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 7, 15, 12, 0, 0)); // 15/08/2026, meio-dia
});

afterEach(() => jest.useRealTimers());

describe('formatWeight', () => {
  it('distingue "não definida" de "peso corporal"', () => {
    // NULL é carga a definir — o estado de uma ficha recém-gerada.
    // Escrever "Peso corporal" num supino afirmaria algo falso.
    expect(formatWeight(null)).toBe('—');
    expect(formatWeight(undefined)).toBe('—');
    // Zero é a escolha explícita de treinar sem carga.
    expect(formatWeight(0)).toBe('Sem carga');
  });

  it('formata com vírgula decimal e sem zeros à toa', () => {
    expect(formatWeight(30)).toBe('30 kg');
    expect(formatWeight(22.5)).toBe('22,5 kg');
    expect(formatWeight(24.0)).toBe('24 kg');
  });
});

describe('formatRest', () => {
  it('converte segundos em minutos quando faz sentido', () => {
    expect(formatRest(45)).toBe('45s');
    expect(formatRest(60)).toBe('1min');
    expect(formatRest(90)).toBe('1min 30s');
    expect(formatRest(120)).toBe('2min');
  });

  it('trata os casos de borda', () => {
    expect(formatRest(null)).toBe('—');
    expect(formatRest(0)).toBe('Sem descanso');
  });
});

describe('formatRelativeDay', () => {
  it('usa linguagem do dia a dia para datas recentes', () => {
    expect(formatRelativeDay('2026-08-15T08:00:00')).toBe('hoje');
    expect(formatRelativeDay('2026-08-14T22:00:00')).toBe('ontem');
    expect(formatRelativeDay('2026-08-12T10:00:00')).toBe('há 3 dias');
    expect(formatRelativeDay('2026-08-08T10:00:00')).toBe('há 7 dias');
  });

  it('volta à data absoluta acima de uma semana', () => {
    // Contar "há 43 dias" não ajuda ninguém a se situar.
    expect(formatRelativeDay('2026-08-07T10:00:00')).toBe('07/08/2026');
    expect(formatRelativeDay('2026-06-01T10:00:00')).toBe('01/06/2026');
  });

  it('compara pelo DIA, não por 24 horas cheias', () => {
    // 23h de ontem para 12h de hoje são 13 horas, mas são dias
    // diferentes — o usuário lê isso como "ontem".
    expect(formatRelativeDay('2026-08-14T23:30:00')).toBe('ontem');
    // E 00h30 de hoje é "hoje", mesmo tendo quase 12 horas.
    expect(formatRelativeDay('2026-08-15T00:30:00')).toBe('hoje');
  });

  it('não quebra com data inválida', () => {
    expect(formatRelativeDay('não é data')).toBe('—');
  });
});

describe('cronômetro do treino', () => {
  it('mede segundos inteiros entre início e fim', () => {
    expect(elapsedSeconds('2026-08-15T10:00:00Z', '2026-08-15T10:52:30Z')).toBe(3150);
  });

  it('sem fim, conta até agora', () => {
    const now = new Date('2026-08-15T10:01:05Z').getTime();
    expect(elapsedSeconds('2026-08-15T10:00:00Z', null, now)).toBe(65);
  });

  it('formata o relógio com horas só quando passa de uma hora', () => {
    expect(formatClock(75)).toBe('01:15');
    expect(formatClock(3725)).toBe('1:02:05');
  });

  it('formata a duração registrada', () => {
    expect(formatDuration(40)).toBe('40s');
    expect(formatDuration(2700)).toBe('45min');
    expect(formatDuration(3900)).toBe('1h 05min');
  });
});
