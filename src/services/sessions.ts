/**
 * Serviço de sessões de treino.
 *
 * Uma sessão é um treino cronometrado: começa em `started_at` ao
 * tocar em "Iniciar treino" e termina em `completed_at` ao finalizar.
 * A duração é a diferença entre os dois — não há nada a marcar
 * exercício a exercício.
 *
 * As cargas vêm da ficha: cada execução guarda uma cópia da
 * prescrição no momento em que o treino começou, para o histórico
 * de evolução não mudar quando a ficha for editada depois.
 *
 * As regras que na versão SQL eram triggers — só treinar em ciclo
 * ativo, uma sessão em andamento por vez — moram aqui, e as escritas
 * que dependem do estado atual rodam em transação.
 */
import {
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  where,
} from 'firebase/firestore';
import type { DocumentReference } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AppError, toAppError } from '../lib/errors';
import { CYCLE_STATUS_LABELS, computeStatus } from '../utils/cycle';
import { weekDates } from '../utils/schedule';
import type {
  Exercise,
  ExerciseExecutionRow,
  SessionSummary,
  SessionWithExecutions,
  WeekSession,
  WorkoutSession,
} from '../types/models';
import { getExerciseMap } from './exercises';
import { newId, nowIso, requireUid, sessionsCol, workoutsCol } from './firestore';
import type { StoredWorkout } from './workouts';

/** Documento da sessão como fica gravado no Firestore. */
export interface StoredSession extends Omit<WorkoutSession, 'id'> {
  /** Cópia do dia e da ficha no momento do treino. */
  day: SessionWithExecutions['day'];
  executions: ExerciseExecutionRow[];
  /** Exercícios desta sessão, para consultas com `array-contains`. */
  exercise_ids: string[];
}

function sessionRef(uid: string, sessionId: string) {
  return doc(sessionsCol(uid), sessionId) as DocumentReference<StoredSession>;
}

/** Une as execuções ao catálogo e ordena pela ordem da ficha. */
function hydrate(id: string, data: StoredSession, catalog: Map<string, Exercise>): SessionWithExecutions {
  const { executions, exercise_ids: _ids, ...session } = data;

  const joined = (executions ?? []).map((execution) => ({
    ...execution,
    // Se o exercício saiu do catálogo, a cópia guardada na execução
    // mantém o histórico legível.
    exercise: catalog.get(execution.exercise_id) ?? {
      id: execution.exercise_id,
      user_id: data.user_id,
      name: execution.exercise_name,
      description: null,
      muscle_group: execution.muscle_group,
      youtube_video_id: null,
      created_at: '',
      updated_at: '',
    },
  }));

  joined.sort((a, b) => {
    const orderA = a.prescription?.exercise_order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.prescription?.exercise_order ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return a.exercise.name.localeCompare(b.exercise.name, 'pt-BR');
  });

  return { ...session, id, executions: joined };
}

/**
 * Inicia o treino de um DIA — ou devolve a sessão já em andamento.
 *
 * Cria a sessão com uma execução por exercício prescrito naquele dia,
 * já com a carga da ficha como valor inicial, numa escrita só. Se
 * existir sessão pendente para o mesmo dia, ela é retomada em vez de
 * duplicada.
 */
export async function startSession(workoutId: string, workoutDayId: string): Promise<string> {
  const uid = requireUid();

  try {
    // No máximo UMA sessão em andamento: "retomar treino" nunca fica
    // ambíguo e não sobram sessões fantasmas.
    const inProgress = await getDocs(query(sessionsCol(uid), where('status', '==', 'in_progress')));
    const sameDay = inProgress.docs.find((item) => item.data().workout_day_id === workoutDayId);
    if (sameDay) return sameDay.id;
    if (!inProgress.empty) {
      throw new AppError(
        'conflict',
        'Você já tem um treino em andamento. Finalize-o antes de iniciar outro.',
      );
    }

    const [workoutSnapshot, catalog] = await Promise.all([
      getDoc(doc(workoutsCol(uid), workoutId)),
      getExerciseMap(),
    ]);
    const workout = workoutSnapshot.data() as StoredWorkout | undefined;
    if (!workout) throw new AppError('not_found', 'Ficha não encontrada.');

    // Só ciclo ativo aceita treino: senão o acompanhamento seria
    // distorcido por sessões fora do período.
    const status = computeStatus(workout);
    if (status !== 'active') {
      throw new AppError(
        'validation',
        `Este ciclo não está ativo (${CYCLE_STATUS_LABELS[status].toLowerCase()}). ` +
          'Não é possível iniciar novos treinos.',
      );
    }

    const day = (workout.days ?? []).find((item) => item.id === workoutDayId);
    if (!day) throw new AppError('not_found', 'Dia de treino não encontrado.');
    if (day.exercises.length === 0) {
      throw new AppError('validation', 'Adicione exercícios a este dia antes de treinar.');
    }

    const executions: ExerciseExecutionRow[] = [...day.exercises]
      .sort((a, b) => a.exercise_order - b.exercise_order)
      .map((item) => {
        const exercise = catalog.get(item.exercise_id);
        return {
          id: newId(),
          exercise_id: item.exercise_id,
          workout_exercise_id: item.id,
          completed: false,
          load: item.weight,
          completed_at: null,
          prescription: {
            sets: item.sets,
            repetitions: item.repetitions,
            weight: item.weight,
            rest_seconds: item.rest_seconds,
            notes: item.notes,
            exercise_order: item.exercise_order,
          },
          exercise_name: exercise?.name ?? 'Exercício',
          muscle_group: exercise?.muscle_group ?? 'OUTRO',
        };
      });

    const ref = doc(sessionsCol(uid));
    const now = nowIso();
    const data: StoredSession = {
      user_id: uid,
      workout_id: workoutId,
      workout_day_id: workoutDayId,
      started_at: now,
      completed_at: null,
      status: 'in_progress',
      created_at: now,
      day: {
        id: day.id,
        name: day.name,
        focus: day.focus ?? null,
        workout: { id: workoutId, name: workout.name },
      },
      executions,
      exercise_ids: [...new Set(executions.map((item) => item.exercise_id))],
    };

    await setDoc(ref, data);
    return ref.id;
  } catch (error) {
    throw toAppError(error, 'Não foi possível iniciar o treino.');
  }
}

/** A sessão em andamento do usuário, se houver. */
export async function getInProgressSession(): Promise<SessionWithExecutions | null> {
  const uid = requireUid();
  try {
    const [snapshot, catalog] = await Promise.all([
      getDocs(query(sessionsCol(uid), where('status', '==', 'in_progress'))),
      getExerciseMap(),
    ]);
    const first = snapshot.docs[0];
    return first ? hydrate(first.id, first.data() as StoredSession, catalog) : null;
  } catch (error) {
    throw toAppError(error, 'Não foi possível verificar treinos em andamento.');
  }
}

export async function getSession(sessionId: string): Promise<SessionWithExecutions> {
  const uid = requireUid();
  try {
    const [snapshot, catalog] = await Promise.all([getDoc(sessionRef(uid, sessionId)), getExerciseMap()]);
    const data = snapshot.data();
    if (!data) throw new AppError('not_found', 'Treino não encontrado.');
    return hydrate(snapshot.id, data, catalog);
  } catch (error) {
    throw toAppError(error, 'Não foi possível carregar o treino.');
  }
}

/**
 * Finaliza o treino: para o cronômetro (grava `completed_at`) e dá
 * todos os exercícios como feitos, com a carga da ficha.
 */
export async function completeSession(sessionId: string): Promise<void> {
  const uid = requireUid();
  const ref = sessionRef(uid, sessionId);

  try {
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(ref);
      const data = snapshot.data();
      if (!data) throw new AppError('not_found', 'Treino não encontrado.');
      if (data.status === 'completed') return;

      const now = nowIso();
      const executions = data.executions.map((item) => ({ ...item, completed: true, completed_at: now }));
      transaction.update(ref, { status: 'completed', completed_at: now, executions });
    });
  } catch (error) {
    throw toAppError(error, 'Não foi possível finalizar o treino.');
  }
}

/**
 * Descarta uma sessão iniciada por engano.
 *
 * Sair do treino NÃO chama isto: nesse caso a sessão continua
 * `in_progress` para ser retomada depois. Este é o descarte
 * explícito, com confirmação na interface.
 */
export async function discardSession(sessionId: string): Promise<void> {
  const uid = requireUid();
  try {
    await deleteDoc(sessionRef(uid, sessionId));
  } catch (error) {
    throw toAppError(error, 'Não foi possível descartar o treino.');
  }
}

/** Sessões gravadas de uma ficha (ou de todas, sem `workoutId`). */
export async function readSessions(workoutId?: string): Promise<{ id: string; data: StoredSession }[]> {
  const uid = requireUid();
  const source = workoutId
    ? query(sessionsCol(uid), where('workout_id', '==', workoutId))
    : sessionsCol(uid);
  const snapshot = await getDocs(source);
  return snapshot.docs.map((item) => ({ id: item.id, data: item.data() as StoredSession }));
}

/**
 * Histórico de sessões de um ciclo, da mais recente para a mais antiga.
 *
 * A ordenação é feita no aparelho: um `orderBy` junto do `where`
 * exigiria criar um índice composto no console do Firebase, e o
 * volume (treinos de UM ciclo) torna isso desnecessário.
 */
export async function listSessions(workoutId: string): Promise<SessionSummary[]> {
  try {
    const sessions = await readSessions(workoutId);
    return sessions
      .map(({ id, data }) => toSummary(id, data))
      .sort((a, b) => b.started_at.localeCompare(a.started_at));
  } catch (error) {
    throw toAppError(error, 'Não foi possível carregar o histórico.');
  }
}

/**
 * Treinos iniciados na semana atual (segunda a domingo), em
 * andamento ou finalizados — a base da programação da home. Vêm com
 * as execuções: um dia que já passou mostra o que foi FEITO, mesmo
 * que a ficha tenha mudado depois.
 */
export async function listWeekSessions(): Promise<WeekSession[]> {
  const uid = requireUid();
  const dates = weekDates();
  const monday = dates[0] as Date;
  const nextMonday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7);

  try {
    // Só um campo no filtro: o Firestore resolve com o índice
    // automático, sem precisar criar índice composto.
    const snapshot = await getDocs(
      query(
        sessionsCol(uid),
        where('started_at', '>=', monday.toISOString()),
        where('started_at', '<', nextMonday.toISOString()),
      ),
    );
    return snapshot.docs
      .map((item) => {
        const data = item.data() as StoredSession;
        const executions = [...(data.executions ?? [])].sort(
          (a, b) =>
            (a.prescription?.exercise_order ?? Number.MAX_SAFE_INTEGER) -
            (b.prescription?.exercise_order ?? Number.MAX_SAFE_INTEGER),
        );
        return { ...toSummary(item.id, data), executions };
      })
      .sort((a, b) => a.started_at.localeCompare(b.started_at));
  } catch (error) {
    throw toAppError(error, 'Não foi possível carregar os treinos da semana.');
  }
}

function toSummary(id: string, data: StoredSession): SessionSummary {
  const executions = data.executions ?? [];
  return {
    id,
    user_id: data.user_id,
    workout_day_id: data.workout_day_id,
    workout_id: data.workout_id,
    started_at: data.started_at,
    completed_at: data.completed_at,
    status: data.status,
    created_at: data.created_at,
    dayName: data.day?.name ?? 'Treino',
    totalCount: executions.length,
    completedCount: executions.filter((item) => item.completed).length,
  };
}
