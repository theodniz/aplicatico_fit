/**
 * Serviço de acompanhamento e evolução.
 *
 * REGRA QUE GOVERNA ESTE ARQUIVO: nenhum número é estimado.
 *
 * Tudo aqui sai de sessões e execuções realmente gravadas. Se o
 * usuário não definiu meta de treinos, não existe percentual de
 * frequência — a interface mostra o número absoluto e nada mais.
 * Inventar um denominador ("supomos 3 treinos por semana") daria
 * ao usuário uma métrica que não corresponde a nada.
 *
 * Os agregados são calculados no aparelho: o volume é o histórico de
 * UMA pessoa — algumas centenas de sessões por ano —, e o Firestore
 * não tem GROUP BY.
 */
import { getDocs, query, where } from 'firebase/firestore';
import { toAppError } from '../lib/errors';
import type {
  CycleStats,
  ExerciseExecutionRow,
  ExerciseProgress,
  LoadHistoryPoint,
} from '../types/models';
import { getExerciseMap } from './exercises';
import { requireUid, sessionsCol } from './firestore';
import { readSessions } from './sessions';
import type { StoredSession } from './sessions';

/** Contadores do ciclo, direto das sessões. */
export async function getCycleStats(workoutId: string): Promise<CycleStats> {
  try {
    const sessions = await readSessions(workoutId);
    const completedSessions = sessions.filter(({ data }) => data.status === 'completed').length;

    // A última sessão alimenta a sugestão do próximo treino.
    const last = [...sessions].sort((a, b) => b.data.started_at.localeCompare(a.data.started_at))[0];

    return {
      totalSessions: sessions.length,
      completedSessions,
      inProgressSessions: sessions.length - completedSessions,
      lastSessionAt: last?.data.started_at ?? null,
      lastSessionDayId: last?.data.workout_day_id ?? null,
      lastSessionDayName: last?.data.day?.name ?? null,
    };
  } catch (error) {
    throw toAppError(error, 'Não foi possível carregar o acompanhamento.');
  }
}

/** Execuções concluídas, em ordem cronológica. */
function completedExecutions(sessions: { data: StoredSession }[]) {
  return sessions
    .flatMap(({ data }) => data.executions ?? [])
    .filter((item): item is ExerciseExecutionRow & { completed_at: string } =>
      item.completed && item.completed_at !== null,
    )
    .sort((a, b) => a.completed_at.localeCompare(b.completed_at));
}

/**
 * Evolução de carga por exercício.
 *
 * @param workoutId  Restringe a um ciclo. Omitido, considera todo o
 *                   histórico do usuário — é assim que a evolução
 *                   atravessa ciclos, já que ao duplicar uma ficha
 *                   as prescrições são novas mas o exercício é o
 *                   mesmo registro.
 */
export async function getExerciseProgress(workoutId?: string): Promise<ExerciseProgress[]> {
  try {
    const [sessions, catalog] = await Promise.all([readSessions(workoutId), getExerciseMap()]);
    const rows = completedExecutions(sessions);

    const byExercise = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = byExercise.get(row.exercise_id);
      if (list) list.push(row);
      else byExercise.set(row.exercise_id, [row]);
    }

    const progress: ExerciseProgress[] = [];

    for (const [exerciseId, executions] of byExercise) {
      // Execuções sem carga contam como treino realizado, mas não
      // entram no cálculo de evolução de peso.
      const loads = executions
        .map((item) => item.load)
        .filter((load): load is number => load !== null);

      const first = loads[0] ?? null;
      const latest = loads[loads.length - 1] ?? null;
      const maxLoad = loads.length > 0 ? Math.max(...loads) : null;

      // Delta só existe com pelo menos DUAS execuções com carga.
      // Com uma só, "evoluiu 0 kg" seria enganoso — não houve
      // comparação, houve um único ponto.
      const delta =
        loads.length >= 2 && first !== null && latest !== null
          ? Math.round((latest - first) * 100) / 100
          : null;

      const exercise = catalog.get(exerciseId);
      const sample = executions[0];

      progress.push({
        exerciseId,
        exerciseName: exercise?.name ?? sample?.exercise_name ?? 'Exercício',
        muscleGroup: exercise?.muscle_group ?? sample?.muscle_group ?? 'OUTRO',
        firstLoad: first,
        latestLoad: latest,
        maxLoad,
        delta,
        lastPerformedAt: executions[executions.length - 1]?.completed_at ?? null,
        sessionCount: executions.length,
      });
    }

    // Maior evolução primeiro; sem evolução calculável vai para o fim.
    return progress.sort((a, b) => (b.delta ?? -Infinity) - (a.delta ?? -Infinity));
  } catch (error) {
    throw toAppError(error, 'Não foi possível carregar a evolução.');
  }
}

/** Série temporal de carga de um exercício, para lista ou gráfico. */
export async function getLoadHistory(exerciseId: string): Promise<LoadHistoryPoint[]> {
  const uid = requireUid();
  try {
    const snapshot = await getDocs(
      query(sessionsCol(uid), where('exercise_ids', 'array-contains', exerciseId)),
    );
    const sessions = snapshot.docs.map((item) => ({ data: item.data() as StoredSession }));

    return completedExecutions(sessions)
      .filter((item) => item.exercise_id === exerciseId)
      .map((item) => ({ date: item.completed_at, load: item.load }));
  } catch (error) {
    throw toAppError(error, 'Não foi possível carregar o histórico de carga.');
  }
}

