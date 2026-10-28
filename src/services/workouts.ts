/**
 * Serviço de fichas / ciclos de treino.
 *
 * Estrutura em três níveis, num documento só:
 *
 *   users/{uid}/workouts/{id}   (ciclo)
 *     └── days[]                (Dia 1, Dia 2… e os dias da semana de cada um)
 *           └── exercises[]     (prescrição)
 *
 * Toda alteração de dias e prescrições passa por `mutateWorkout`, que
 * lê e regrava o documento numa TRANSAÇÃO. É o substituto das funções
 * SQL da versão anterior: reordenar, gerar ou excluir um dia nunca
 * deixa a ficha pela metade se a conexão cair no meio — cenário nada
 * teórico em rede de academia.
 */
import {
  addDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import type { DocumentReference, Transaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AppError, toAppError } from '../lib/errors';
import { computeStatus } from '../utils/cycle';
import { WEEKDAY_NAMES, normalizeWeekdays } from '../utils/schedule';
import type {
  DuplicateWorkoutInput,
  Exercise,
  Workout,
  WorkoutDayInput,
  WorkoutDayRow,
  WorkoutExerciseInput,
  WorkoutExerciseRow,
  WorkoutInput,
  WorkoutSummary,
  WorkoutWithDays,
} from '../types/models';
import { getExerciseMap } from './exercises';
import { deleteInBatches, newId, nowIso, requireUid, sessionsCol, workoutsCol } from './firestore';

/** Dia como fica gravado: com as prescrições cruas, sem o exercício. */
export interface StoredDay extends WorkoutDayRow {
  exercises: WorkoutExerciseRow[];
}

/** Documento da ficha como fica gravado no Firestore. */
export interface StoredWorkout extends Omit<Workout, 'id'> {
  days: StoredDay[];
  /**
   * Todos os exercícios usados em qualquer dia. Redundante de
   * propósito: permite perguntar "este exercício está em alguma
   * ficha?" com um `array-contains`, sem ler as fichas inteiras.
   */
  exercise_ids: string[];
}

function workoutRef(uid: string, workoutId: string) {
  return doc(workoutsCol(uid), workoutId) as DocumentReference<StoredWorkout>;
}

/** Extrai só os campos do ciclo, sem a divisão. */
function toWorkout(id: string, data: StoredWorkout): Workout {
  return {
    id,
    user_id: data.user_id,
    name: data.name,
    description: data.description ?? null,
    start_date: data.start_date,
    end_date: data.end_date,
    completed_at: data.completed_at ?? null,
    session_goal: data.session_goal ?? null,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

function collectExerciseIds(days: StoredDay[]): string[] {
  return [...new Set(days.flatMap((day) => day.exercises.map((item) => item.exercise_id)))];
}

/** Exercício que sumiu do catálogo, para a ficha não quebrar ao abrir. */
function missingExercise(id: string, userId: string): Exercise {
  return {
    id,
    user_id: userId,
    name: 'Exercício removido',
    description: null,
    muscle_group: 'OUTRO',
    youtube_video_id: null,
    created_at: '',
    updated_at: '',
  };
}

/** Une a ficha gravada ao catálogo e ordena dias e exercícios. */
function hydrate(id: string, data: StoredWorkout, catalog: Map<string, Exercise>): WorkoutWithDays {
  return {
    ...toWorkout(id, data),
    days: [...(data.days ?? [])]
      .sort((a, b) => a.day_order - b.day_order)
      .map((day) => ({
        ...day,
        weekdays: normalizeWeekdays(day.weekdays),
        exercises: [...(day.exercises ?? [])]
          .sort((a, b) => a.exercise_order - b.exercise_order)
          .map((item) => ({
            ...item,
            exercise: catalog.get(item.exercise_id) ?? missingExercise(item.exercise_id, data.user_id),
          })),
      })),
  };
}

function toSummary(id: string, data: StoredWorkout, sessionCount: number): WorkoutSummary {
  const workout = toWorkout(id, data);
  const days = data.days ?? [];
  return {
    ...workout,
    dayCount: days.length,
    exerciseCount: days.reduce((sum, day) => sum + (day.exercises?.length ?? 0), 0),
    sessionCount,
    status: computeStatus(workout),
  };
}

async function readAllWorkouts(uid: string): Promise<{ id: string; data: StoredWorkout }[]> {
  const snapshot = await getDocs(workoutsCol(uid));
  return snapshot.docs.map((item) => ({ id: item.id, data: item.data() as StoredWorkout }));
}

/**
 * "Uma ficha ativa por vez": dois ciclos não encerrados não podem ter
 * períodos sobrepostos. Na versão SQL era uma constraint EXCLUDE; o
 * Firestore não tem nada equivalente, então a regra mora aqui e roda
 * antes de toda escrita que mexe em datas ou reabre um ciclo.
 */
async function assertNoOverlap(
  uid: string,
  startDate: string,
  endDate: string,
  ignoreId?: string,
): Promise<void> {
  const workouts = await readAllWorkouts(uid);

  // Strings 'YYYY-MM-DD' comparam na ordem cronológica.
  const clash = workouts.find(
    ({ id, data }) =>
      id !== ignoreId &&
      !data.completed_at &&
      data.start_date <= endDate &&
      startDate <= data.end_date,
  );

  if (clash) {
    throw new AppError(
      'conflict',
      `Já existe uma ficha ativa nesse período ("${clash.data.name}"). ` +
        'Encerre o ciclo atual ou ajuste as datas.',
    );
  }
}

/**
 * Fichas do usuário, com contagens e status do ciclo.
 *
 * Duas leituras: as fichas e as sessões (para "18 treinos feitos").
 * O volume é o histórico de UMA pessoa, então contar no aparelho é
 * mais simples do que manter contadores sincronizados.
 */
export async function listWorkouts(): Promise<WorkoutSummary[]> {
  const uid = requireUid();
  try {
    const [workouts, sessions] = await Promise.all([
      readAllWorkouts(uid),
      getDocs(sessionsCol(uid)),
    ]);

    const sessionsByWorkout = new Map<string, number>();
    for (const session of sessions.docs) {
      const workoutId = session.data().workout_id as string;
      sessionsByWorkout.set(workoutId, (sessionsByWorkout.get(workoutId) ?? 0) + 1);
    }

    return workouts
      .map(({ id, data }) => toSummary(id, data, sessionsByWorkout.get(id) ?? 0))
      .sort((a, b) => b.start_date.localeCompare(a.start_date));
  } catch (error) {
    throw toAppError(error, 'Não foi possível carregar seus treinos.');
  }
}

/**
 * O ciclo ativo de hoje, ou null.
 *
 * A checagem de sobreposição deveria garantir no máximo um, mas se
 * houver mais (dados antigos, duas gravações simultâneas), o app
 * escolhe o que começou mais tarde e segue funcionando — degradar é
 * melhor do que quebrar o dashboard.
 */
export async function getActiveWorkout(): Promise<WorkoutSummary | null> {
  const workouts = await listWorkouts();
  return workouts.find((workout) => workout.status === 'active') ?? null;
}

/** Ficha completa: ciclo, dias e exercícios de cada dia. */
export async function getWorkout(workoutId: string): Promise<WorkoutWithDays> {
  const uid = requireUid();
  try {
    const [snapshot, catalog] = await Promise.all([
      getDoc(workoutRef(uid, workoutId)),
      getExerciseMap(),
    ]);

    const data = snapshot.data();
    if (!data) {
      throw new AppError('not_found', 'Ficha não encontrada ou indisponível para o seu usuário.');
    }
    return hydrate(snapshot.id, data, catalog);
  } catch (error) {
    throw toAppError(error, 'Não foi possível carregar esta ficha.');
  }
}

export async function createWorkout(input: WorkoutInput): Promise<Workout> {
  const uid = requireUid();
  await assertNoOverlap(uid, input.start_date, input.end_date);

  const now = nowIso();
  const data: StoredWorkout = {
    user_id: uid,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    start_date: input.start_date,
    end_date: input.end_date,
    completed_at: null,
    session_goal: input.session_goal,
    created_at: now,
    updated_at: now,
    days: [],
    exercise_ids: [],
  };

  try {
    const ref = await addDoc(workoutsCol(uid), data);
    return toWorkout(ref.id, data);
  } catch (error) {
    throw toAppError(error, 'Não foi possível criar a ficha.');
  }
}

export async function updateWorkout(workoutId: string, input: WorkoutInput): Promise<void> {
  const uid = requireUid();
  const snapshot = await getDoc(workoutRef(uid, workoutId));
  const current = snapshot.data();
  if (!current) throw new AppError('not_found', 'Ficha não encontrada.');

  // Ciclo encerrado não disputa período com ninguém.
  if (!current.completed_at) {
    await assertNoOverlap(uid, input.start_date, input.end_date, workoutId);
  }

  try {
    await updateDoc(workoutRef(uid, workoutId), {
      name: input.name.trim(),
      description: input.description?.trim() || null,
      start_date: input.start_date,
      end_date: input.end_date,
      session_goal: input.session_goal,
      updated_at: nowIso(),
    });
  } catch (error) {
    throw toAppError(error, 'Não foi possível salvar a ficha.');
  }
}

/**
 * Encerra o ciclo manualmente, antes da data de término.
 *
 * Não apaga nada: a ficha e todo o histórico continuam disponíveis
 * para consulta. O que muda é que ela deixa de aceitar treinos
 * novos e libera o período para um ciclo seguinte.
 */
export async function completeWorkout(workoutId: string): Promise<void> {
  const uid = requireUid();
  try {
    const now = nowIso();
    await updateDoc(workoutRef(uid, workoutId), { completed_at: now, updated_at: now });
  } catch (error) {
    throw toAppError(error, 'Não foi possível encerrar o ciclo.');
  }
}

/** Desfaz o encerramento manual, reabrindo o ciclo. */
export async function reopenWorkout(workoutId: string): Promise<void> {
  const uid = requireUid();
  const snapshot = await getDoc(workoutRef(uid, workoutId));
  const current = snapshot.data();
  if (!current) throw new AppError('not_found', 'Ficha não encontrada.');

  // Reabrir pode colidir com outro ciclo criado no intervalo.
  await assertNoOverlap(uid, current.start_date, current.end_date, workoutId);

  try {
    await updateDoc(workoutRef(uid, workoutId), { completed_at: null, updated_at: nowIso() });
  } catch (error) {
    throw toAppError(error, 'Não foi possível reabrir o ciclo.');
  }
}

/** Exclui a ficha e, junto, todas as sessões dela (o antigo CASCADE). */
export async function deleteWorkout(workoutId: string): Promise<void> {
  const uid = requireUid();
  try {
    const sessions = await getDocs(query(sessionsCol(uid), where('workout_id', '==', workoutId)));
    await deleteInBatches([...sessions.docs.map((item) => item.ref), workoutRef(uid, workoutId)]);
  } catch (error) {
    throw toAppError(error, 'Não foi possível excluir a ficha.');
  }
}

/**
 * Cria um ciclo novo a partir de um existente.
 *
 * Copia ficha, dias e prescrições (com ids novos) e deliberadamente
 * NÃO copia sessões nem histórico, para o ciclo novo começar zerado.
 * Os `exercise_id` são os mesmos — é isso que faz a evolução de carga
 * atravessar ciclos.
 */
export async function duplicateWorkout(input: DuplicateWorkoutInput): Promise<string> {
  const uid = requireUid();
  const snapshot = await getDoc(workoutRef(uid, input.sourceId));
  const source = snapshot.data();
  if (!source) throw new AppError('not_found', 'Ficha de origem não encontrada.');

  await assertNoOverlap(uid, input.start_date, input.end_date);

  // Id gerado antes da escrita: os dias já nascem apontando para a
  // ficha nova, numa gravação só.
  const ref = doc(workoutsCol(uid)) as DocumentReference<StoredWorkout>;
  const now = nowIso();
  const days: StoredDay[] = (source.days ?? []).map((day) => {
    const dayId = newId();
    return {
      ...day,
      id: dayId,
      workout_id: ref.id,
      created_at: now,
      updated_at: now,
      exercises: (day.exercises ?? []).map((item) => ({
        ...item,
        id: newId(),
        workout_day_id: dayId,
        created_at: now,
        updated_at: now,
      })),
    };
  });

  try {
    await setDoc(ref, {
      user_id: uid,
      name: input.name.trim(),
      description: source.description ?? null,
      start_date: input.start_date,
      end_date: input.end_date,
      completed_at: null,
      session_goal: source.session_goal ?? null,
      created_at: now,
      updated_at: now,
      days,
      exercise_ids: collectExerciseIds(days),
    });
    return ref.id;
  } catch (error) {
    throw toAppError(error, 'Não foi possível duplicar a ficha.');
  }
}

// ---------------------------------------------------------------
// Mutação transacional da divisão
// ---------------------------------------------------------------

/**
 * Lê a ficha, aplica `mutate` sobre uma cópia e grava o resultado,
 * tudo numa transação. Se outra gravação acontecer no meio, o
 * Firestore repete a transação com o dado novo.
 */
export async function mutateWorkout<T>(
  workoutId: string,
  fallback: string,
  mutate: (workout: StoredWorkout, transaction: Transaction) => T,
): Promise<T> {
  const uid = requireUid();
  const ref = workoutRef(uid, workoutId);

  try {
    return await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(ref);
      const data = snapshot.data();
      if (!data) throw new AppError('not_found', 'Ficha não encontrada.');

      const workout: StoredWorkout = {
        ...data,
        days: (data.days ?? []).map((day) => ({ ...day, exercises: [...(day.exercises ?? [])] })),
      };

      const result = mutate(workout, transaction);

      transaction.update(ref, {
        days: workout.days,
        exercise_ids: collectExerciseIds(workout.days),
        updated_at: nowIso(),
      });
      return result;
    });
  } catch (error) {
    throw toAppError(error, fallback);
  }
}

function findDay(workout: StoredWorkout, dayId: string): StoredDay {
  const day = workout.days.find((item) => item.id === dayId);
  if (!day) throw new AppError('not_found', 'Dia de treino não encontrado.');
  return day;
}

/** Renumera 1, 2, 3… seguindo a ordem do array. */
function renumber<T>(items: T[], field: keyof T): void {
  items.forEach((item, index) => {
    (item[field] as unknown as number) = index + 1;
  });
}

// ---------------------------------------------------------------
// Dias da divisão
// ---------------------------------------------------------------

/**
 * Cada dia da semana pertence a no máximo um dia da ficha: a home
 * mostra UM treino por data, e "segunda é Dia 1 e Dia 3" não tem
 * como ser executado.
 */
function assignWeekdays(workout: StoredWorkout, weekdays: number[], dayId: string | null): number[] {
  const normalized = normalizeWeekdays(weekdays);
  for (const weekday of normalized) {
    const owner = workout.days.find(
      (day) => day.id !== dayId && normalizeWeekdays(day.weekdays).includes(weekday),
    );
    if (owner) {
      throw new AppError('conflict', `${WEEKDAY_NAMES[weekday]} já está programada para "${owner.name}".`);
    }
  }
  return normalized;
}

/** Cria um dia ao final da divisão. */
export async function createWorkoutDay(workoutId: string, input: WorkoutDayInput): Promise<WorkoutDayRow> {
  return mutateWorkout(workoutId, 'Não foi possível criar o dia.', (workout) => {
    const now = nowIso();
    const day: StoredDay = {
      id: newId(),
      workout_id: workoutId,
      name: input.name.trim(),
      focus: input.focus?.trim() || null,
      day_order: Math.max(0, ...workout.days.map((item) => item.day_order)) + 1,
      weekdays: assignWeekdays(workout, input.weekdays, null),
      created_at: now,
      updated_at: now,
      exercises: [],
    };
    workout.days.push(day);
    const { exercises: _exercises, ...row } = day;
    return row;
  });
}

export async function updateWorkoutDay(
  workoutId: string,
  dayId: string,
  input: WorkoutDayInput,
): Promise<void> {
  await mutateWorkout(workoutId, 'Não foi possível salvar o dia.', (workout) => {
    const day = findDay(workout, dayId);
    day.name = input.name.trim();
    day.focus = input.focus?.trim() || null;
    day.weekdays = assignWeekdays(workout, input.weekdays, dayId);
    day.updated_at = nowIso();
  });
}

/**
 * Exclui um dia da divisão.
 *
 * Leva junto as prescrições e as SESSÕES daquele dia, na mesma
 * transação. A interface avisa disso na confirmação.
 */
export async function deleteWorkoutDay(workoutId: string, dayId: string): Promise<void> {
  const uid = requireUid();
  // Consultas não rodam dentro de transação no SDK cliente; os
  // documentos encontrados aqui são excluídos lá dentro.
  const sessions = await getDocs(query(sessionsCol(uid), where('workout_day_id', '==', dayId)));

  await mutateWorkout(workoutId, 'Não foi possível excluir o dia.', (workout, transaction) => {
    findDay(workout, dayId);
    workout.days = workout.days
      .filter((day) => day.id !== dayId)
      .sort((a, b) => a.day_order - b.day_order);
    renumber(workout.days, 'day_order');
    for (const session of sessions.docs) transaction.delete(session.ref);
  });
}

export async function reorderDays(workoutId: string, orderedIds: string[]): Promise<void> {
  await mutateWorkout(workoutId, 'Não foi possível reordenar os dias.', (workout) => {
    const byId = new Map(workout.days.map((day) => [day.id, day]));
    if (orderedIds.length !== byId.size || orderedIds.some((id) => !byId.has(id))) {
      throw new AppError('conflict', 'A ficha mudou enquanto você reordenava. Tente novamente.');
    }
    workout.days = orderedIds.map((id) => byId.get(id) as StoredDay);
    renumber(workout.days, 'day_order');
  });
}

// ---------------------------------------------------------------
// Exercícios dentro do dia
// ---------------------------------------------------------------

export async function addExerciseToDay(
  workoutId: string,
  dayId: string,
  input: WorkoutExerciseInput,
): Promise<void> {
  await mutateWorkout(workoutId, 'Não foi possível adicionar o exercício.', (workout) => {
    const day = findDay(workout, dayId);

    // O mesmo exercício pode repetir entre dias, mas não dentro do
    // mesmo dia — duas linhas iguais confundiriam o treino.
    if (day.exercises.some((item) => item.exercise_id === input.exercise_id)) {
      throw new AppError('conflict', 'Este exercício já está neste dia.');
    }

    const now = nowIso();
    day.exercises.push({
      id: newId(),
      workout_day_id: dayId,
      exercise_id: input.exercise_id,
      sets: input.sets,
      repetitions: input.repetitions.trim(),
      weight: input.weight,
      rest_seconds: input.rest_seconds,
      notes: input.notes?.trim() || null,
      exercise_order: Math.max(0, ...day.exercises.map((item) => item.exercise_order)) + 1,
      created_at: now,
      updated_at: now,
    });
  });
}

function findPrescription(workout: StoredWorkout, prescriptionId: string) {
  for (const day of workout.days) {
    const index = day.exercises.findIndex((item) => item.id === prescriptionId);
    if (index !== -1) return { day, index };
  }
  throw new AppError('not_found', 'Exercício não encontrado nesta ficha.');
}

export async function updatePrescription(
  workoutId: string,
  prescriptionId: string,
  input: Omit<WorkoutExerciseInput, 'exercise_id'>,
): Promise<void> {
  await mutateWorkout(workoutId, 'Não foi possível salvar as alterações.', (workout) => {
    const { day, index } = findPrescription(workout, prescriptionId);
    const current = day.exercises[index] as WorkoutExerciseRow;
    day.exercises[index] = {
      ...current,
      sets: input.sets,
      repetitions: input.repetitions.trim(),
      weight: input.weight,
      rest_seconds: input.rest_seconds,
      notes: input.notes?.trim() || null,
      updated_at: nowIso(),
    };
  });
}

export async function removeExerciseFromDay(workoutId: string, prescriptionId: string): Promise<void> {
  await mutateWorkout(workoutId, 'Não foi possível remover o exercício.', (workout) => {
    const { day, index } = findPrescription(workout, prescriptionId);
    day.exercises.splice(index, 1);
    day.exercises.sort((a, b) => a.exercise_order - b.exercise_order);
    // Sem buracos na numeração: "1, 2, 4" na ficha parece erro.
    renumber(day.exercises, 'exercise_order');
  });
}

export async function reorderExercises(
  workoutId: string,
  dayId: string,
  orderedIds: string[],
): Promise<void> {
  await mutateWorkout(workoutId, 'Não foi possível reordenar os exercícios.', (workout) => {
    const day = findDay(workout, dayId);
    const byId = new Map(day.exercises.map((item) => [item.id, item]));
    if (orderedIds.length !== byId.size || orderedIds.some((id) => !byId.has(id))) {
      throw new AppError('conflict', 'O dia mudou enquanto você reordenava. Tente novamente.');
    }
    day.exercises = orderedIds.map((id) => byId.get(id) as WorkoutExerciseRow);
    renumber(day.exercises, 'exercise_order');
  });
}
