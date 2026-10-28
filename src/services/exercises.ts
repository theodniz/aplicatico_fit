/**
 * Serviço do catálogo de exercícios.
 */
import {
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { AppError, toAppError } from '../lib/errors';
import { extractVideoId } from '../utils/youtube';
import type { Exercise, ExerciseInput, MuscleGroup } from '../types/models';
import {
  exercisesCol,
  normalizeName,
  nowIso,
  requireUid,
  sessionsCol,
  workoutsCol,
} from './firestore';

export interface ExerciseFilters {
  search?: string;
  muscleGroup?: MuscleGroup | 'ALL';
}

/**
 * O catálogo inteiro do usuário, em ordem alfabética.
 *
 * O Firestore não tem busca por trecho (`ilike '%supino%'`), então a
 * lista vem inteira e é filtrada no aparelho por `filterExercises`.
 * Com um catálogo de dezenas/centenas de itens isso é uma leitura só,
 * cacheada pelo TanStack Query — mais barato do que uma consulta por
 * tecla digitada.
 */
export async function listExercises(): Promise<Exercise[]> {
  const uid = requireUid();
  try {
    const snapshot = await getDocs(exercisesCol(uid));
    return snapshot.docs
      .map((item) => ({ ...(item.data() as Omit<Exercise, 'id'>), id: item.id }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  } catch (error) {
    throw toAppError(error, 'Não foi possível carregar os exercícios.');
  }
}

/** Busca por trecho do nome (sem acento/caixa) e filtro por grupo. */
export function filterExercises(exercises: Exercise[], filters: ExerciseFilters): Exercise[] {
  const search = normalizeName(filters.search ?? '');
  const group = filters.muscleGroup && filters.muscleGroup !== 'ALL' ? filters.muscleGroup : null;

  return exercises.filter(
    (exercise) =>
      (!group || exercise.muscle_group === group) &&
      (!search || normalizeName(exercise.name).includes(search)),
  );
}

/** Mapa id → exercício, usado para unir prescrições e execuções. */
export async function getExerciseMap(): Promise<Map<string, Exercise>> {
  const list = await listExercises();
  return new Map(list.map((exercise) => [exercise.id, exercise]));
}

/**
 * Nome único por usuário, sem diferenciar caixa e acento — o papel
 * do índice único `(user_id, lower(trim(name)))` da versão SQL.
 */
async function assertUniqueName(name: string, ignoreId?: string): Promise<void> {
  const existing = await listExercises();
  const target = normalizeName(name);
  if (existing.some((item) => item.id !== ignoreId && normalizeName(item.name) === target)) {
    throw new AppError('conflict', 'Já existe um exercício com este nome no seu catálogo.');
  }
}

export async function createExercise(input: ExerciseInput): Promise<Exercise> {
  const uid = requireUid();
  await assertUniqueName(input.name);

  const now = nowIso();
  const data = { ...normalize(input), user_id: uid, created_at: now, updated_at: now };

  try {
    const ref = await addDoc(exercisesCol(uid), data);
    return { ...data, id: ref.id };
  } catch (error) {
    throw toAppError(error, 'Não foi possível criar o exercício.');
  }
}

export async function updateExercise(exerciseId: string, input: ExerciseInput): Promise<void> {
  const uid = requireUid();
  await assertUniqueName(input.name, exerciseId);

  try {
    await updateDoc(doc(exercisesCol(uid), exerciseId), {
      ...normalize(input),
      updated_at: nowIso(),
    });
  } catch (error) {
    throw toAppError(error, 'Não foi possível salvar o exercício.');
  }
}

/**
 * Exclui um exercício do catálogo pessoal.
 *
 * Se ele ainda estiver em alguma ficha ou no histórico de treinos, a
 * exclusão é recusada — o papel do `ON DELETE RESTRICT` da versão
 * SQL. Melhor recusar do que apagar em silêncio a prescrição e o
 * histórico de carga dele. `exercise_ids` existe nos documentos de
 * ficha e de sessão justamente para esta consulta ser direta.
 */
export async function deleteExercise(exerciseId: string): Promise<void> {
  const uid = requireUid();

  try {
    const [inWorkouts, inSessions] = await Promise.all([
      getDocs(query(workoutsCol(uid), where('exercise_ids', 'array-contains', exerciseId), limit(1))),
      getDocs(query(sessionsCol(uid), where('exercise_ids', 'array-contains', exerciseId), limit(1))),
    ]);

    if (!inWorkouts.empty || !inSessions.empty) {
      throw new AppError(
        'in_use',
        'Este exercício está sendo usado em algum treino e não pode ser excluído. ' +
          'Remova-o das fichas primeiro.',
      );
    }

    await deleteDoc(doc(exercisesCol(uid), exerciseId));
  } catch (error) {
    throw toAppError(error, 'Não foi possível excluir o exercício.');
  }
}

/**
 * Normaliza a entrada antes de gravar: a URL do YouTube vira o ID
 * de 11 caracteres e os campos vazios viram null, em vez de string
 * vazia (o Firestore também não aceita `undefined`).
 */
function normalize(input: ExerciseInput) {
  return {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    muscle_group: input.muscle_group,
    youtube_video_id: input.youtube_video_id ? extractVideoId(input.youtube_video_id) : null,
  };
}
