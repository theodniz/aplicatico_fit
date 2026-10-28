/**
 * Formatação para leitura na tela — pensada para ser lida de relance,
 * com o celular apoiado no banco do supino.
 */

/**
 * 30 → "30 kg" · 22.5 → "22,5 kg" · 0 → "Sem carga" · null → "—"
 *
 * NULL é "carga não definida", não "peso corporal". Uma ficha
 * recém-gerada nasce com todas as cargas nulas — o sistema não tem
 * como saber quanto você levanta. Escrever "Peso corporal" num
 * supino afirmaria algo falso; o travessão apenas diz "falta
 * preencher". Quem treina de fato com o próprio peso usa 0, que
 * aparece como "Sem carga".
 */
export function formatWeight(weight: number | null | undefined): string {
  if (weight === null || weight === undefined) return '—';
  if (weight === 0) return 'Sem carga';

  // Vírgula decimal e sem ",00" desnecessário.
  const formatted = Number.isInteger(weight)
    ? String(weight)
    : weight.toFixed(2).replace(/\.?0+$/, '').replace('.', ',');

  return `${formatted} kg`;
}

/** 90 → "1min 30s" · 60 → "1min" · 45 → "45s" · null → "—" */
export function formatRest(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '—';
  if (seconds === 0) return 'Sem descanso';
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder === 0 ? `${minutes}min` : `${minutes}min ${remainder}s`;
}

/** Segundos inteiros entre dois instantes ISO (o segundo omitido = agora). */
export function elapsedSeconds(startIso: string, endIso?: string | null, now: number = Date.now()): number {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : now;
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.max(0, Math.floor((end - start) / 1000));
}

/** Cronômetro: 75 → "01:15" · 3725 → "1:02:05" */
export function formatClock(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Duração de treino: 40 → "40s" · 2700 → "45min" · 3900 → "1h 05min" */
export function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours === 0) return `${minutes}min`;
  return `${hours}h ${String(minutes).padStart(2, '0')}min`;
}

/** 4 → "4 séries" · 1 → "1 série" */
export function formatSets(sets: number): string {
  return sets === 1 ? '1 série' : `${sets} séries`;
}

/** "8-12" → "8-12 reps" */
export function formatRepetitions(repetitions: string): string {
  return `${repetitions} reps`;
}

/** Pluralização usada nos contadores das listagens. */
export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** "2026-08-11T10:30:00Z" → "11/08/2026" */
export function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Data em linguagem do dia a dia: "hoje", "ontem", "há 3 dias".
 *
 * Para o último treino, "ontem" responde a pergunta na hora —
 * "11/08/2026" obriga o usuário a calcular. Acima de uma semana a
 * contagem perde utilidade e voltamos à data absoluta.
 */
export function formatRelativeDay(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '—';

  const startOfDay = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate());

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  // Math.round e não floor: no horário de verão o dia tem 23 ou 25
  // horas, e o floor devolveria um dia a menos na virada.
  const days = Math.round(
    (startOfDay(new Date()).getTime() - startOfDay(date).getTime()) / MS_PER_DAY,
  );

  if (days <= 0) return 'hoje';
  if (days === 1) return 'ontem';
  if (days <= 7) return `há ${days} dias`;
  return formatDate(isoDate);
}

/** Primeiro nome, para a saudação do topo. */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

/** Iniciais para o avatar. "Lucas Pablo" → "LP" */
export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return (parts[0] ?? '').slice(0, 2).toUpperCase();
  return `${parts[0]?.[0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase();
}
