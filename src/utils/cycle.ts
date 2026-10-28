/**
 * Lógica de ciclo de treino.
 *
 * `computeStatus` é uma cópia fiel da regra
 * de status usada em `services/sessions.ts`. A duplicação é intencional e
 * assimétrica:
 *
 *   - A camada de serviço é a autoridade. É ela que impede iniciar um treino
 *     em ciclo inativo, antes de gravar no Firestore.
 *   - Esta versão serve só para EXIBIR — pintar o selo "Ativa",
 *     calcular a barra de progresso, contar dias restantes.
 *
 * Se as duas divergirem, o pior que acontece é a interface mostrar
 * um selo errado por um instante; a regra de negócio continua
 * intacta. Qualquer mudança aqui precisa ser espelhada em
 * `src/services/sessions.ts` (startSession).
 */

export type CycleStatus = 'upcoming' | 'active' | 'completed' | 'expired';

/**
 * Converte 'YYYY-MM-DD' em Date no fuso LOCAL.
 *
 * `new Date('2026-08-01')` é interpretado como meia-noite UTC. No
 * horário de Brasília isso vira 31/07 às 21h — a ficha apareceria
 * começando um dia antes, e um ciclo que termina hoje seria dado
 * como expirado. Construir com os componentes separados evita a
 * conversão de fuso por completo.
 */
export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

/** Data de hoje, zerada, para comparar apenas o dia. */
function today(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Diferença em dias inteiros entre duas datas (b - a).
 *
 * `Math.round` e não `floor`: no horário de verão um "dia" tem 23
 * ou 25 horas, e o floor devolveria um dia a menos na virada.
 */
function daysBetween(a: Date, b: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

export interface CycleDates {
  start_date: string;
  end_date: string;
  completed_at: string | null;
}

export function computeStatus(cycle: CycleDates): CycleStatus {
  // Encerramento manual vence a data: o usuário pode fechar um
  // ciclo antes do prazo.
  if (cycle.completed_at) return 'completed';

  const now = today();
  const start = parseDateOnly(cycle.start_date);
  const end = parseDateOnly(cycle.end_date);

  if (now < start) return 'upcoming';
  if (now > end) return 'expired';
  return 'active';
}

export const CYCLE_STATUS_LABELS: Record<CycleStatus, string> = {
  upcoming: 'Próxima',
  active: 'Ativa',
  completed: 'Encerrada',
  expired: 'Expirada',
};

/** Só um ciclo ativo aceita novos treinos. */
export function canTrain(status: CycleStatus): boolean {
  return status === 'active';
}

export interface CycleProgress {
  /** Duração total do ciclo, em dias (inclui as duas pontas). */
  totalDays: number;
  /** Dias já decorridos, limitado ao total. */
  elapsedDays: number;
  /** Dias que faltam até o fim. Zero se já terminou. */
  remainingDays: number;
  /** Percentual do PERÍODO já percorrido (0–100). */
  percent: number;
}

/**
 * Progresso do ciclo no tempo.
 *
 * Mede a passagem dos dias, não a quantidade de treinos — são
 * indicadores diferentes e a interface mostra os dois separados,
 * para não dar a impressão de que "75% do ciclo" significa "75%
 * dos treinos feitos".
 */
export function computeProgress(cycle: CycleDates): CycleProgress {
  const start = parseDateOnly(cycle.start_date);
  const end = parseDateOnly(cycle.end_date);
  const now = today();

  // +1 porque o intervalo inclui o primeiro e o último dia: de 01/08
  // a 01/08 é um ciclo de 1 dia, não de 0.
  const totalDays = Math.max(1, daysBetween(start, end) + 1);

  const rawElapsed = daysBetween(start, now);
  const elapsedDays = Math.min(Math.max(rawElapsed, 0), totalDays);
  const remainingDays = Math.max(daysBetween(now, end), 0);

  return {
    totalDays,
    elapsedDays,
    remainingDays,
    percent: Math.min(100, Math.round((elapsedDays / totalDays) * 100)),
  };
}

/** "01/08/2026 → 30/09/2026" */
export function formatPeriod(cycle: CycleDates): string {
  return `${formatDateOnly(cycle.start_date)} → ${formatDateOnly(cycle.end_date)}`;
}

/** '2026-08-01' → '01/08/2026' */
export function formatDateOnly(value: string): string {
  const date = parseDateOnly(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Data de hoje em 'YYYY-MM-DD', para preencher campos de formulário. */
export function todayAsInputValue(): string {
  const now = today();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Qual dia treinar em seguida.
 *
 * Regra: o dia seguinte ao último treinado, dando a volta ao chegar
 * no fim da divisão. Sem histórico, sugere o primeiro dia.
 *
 * É apenas uma SUGESTÃO — nada impede repetir o mesmo dia ou pular
 * para outro. O corpo às vezes pede repetir um treino, e um sistema
 * que proibisse isso atrapalharia em vez de ajudar.
 *
 * @param days       dias da ficha, em qualquer ordem
 * @param lastDayId  dia do último treino, ou null se nunca treinou
 */
export function suggestNextDayId<T extends { id: string; day_order: number }>(
  days: readonly T[],
  lastDayId: string | null,
): string | null {
  if (days.length === 0) return null;

  const ordered = [...days].sort((a, b) => a.day_order - b.day_order);
  const first = ordered[0];
  if (!first) return null;

  if (!lastDayId) return first.id;

  const lastIndex = ordered.findIndex((day) => day.id === lastDayId);

  // O último dia treinado pode ter sido excluído da ficha depois.
  // Nesse caso recomeçamos do início, em vez de não sugerir nada.
  if (lastIndex === -1) return first.id;

  // O `%` é o que faz a divisão girar: depois do Dia 4 vem o Dia 1.
  return ordered[(lastIndex + 1) % ordered.length]?.id ?? first.id;
}

/** Soma dias a uma data 'YYYY-MM-DD', devolvendo no mesmo formato. */
export function addDaysToInputValue(value: string, days: number): string {
  const date = parseDateOnly(value);
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Texto do tempo restante, já pronto para a tela.
 * Evita "1 dias restantes" e o deselegante "0 dias restantes".
 */
export function describeRemaining(cycle: CycleDates, status: CycleStatus): string {
  if (status === 'completed') return 'Ciclo encerrado';
  if (status === 'expired') return 'Período encerrado';

  if (status === 'upcoming') {
    const days = daysBetween(today(), parseDateOnly(cycle.start_date));
    if (days === 0) return 'Começa hoje';
    if (days === 1) return 'Começa amanhã';
    return `Começa em ${days} dias`;
  }

  const { remainingDays } = computeProgress(cycle);
  if (remainingDays === 0) return 'Último dia';
  if (remainingDays === 1) return '1 dia restante';
  return `${remainingDays} dias restantes`;
}
