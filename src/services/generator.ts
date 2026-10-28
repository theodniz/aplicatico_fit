/**
 * Serviço de geração automática.
 *
 * Duas operações que resolvem o "começar do zero":
 *
 *   importStarterExercises — popula o catálogo pessoal
 *   generateWorkoutPlan    — monta a divisão da ficha
 *
 * O gerador NÃO inventa exercícios: ele escolhe entre os que já
 * estão no catálogo do usuário. Por isso a importação vem antes na
 * ordem natural de uso, e a interface avisa quando um grupo
 * muscular não tem exercícios suficientes.
 */
import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AppError, toAppError } from '../lib/errors';
import { MUSCLE_GROUPS } from '../constants/muscleGroups';
import { STARTER_EXERCISES } from '../constants/starterExercises';
import type { GeneratePlanInput, MuscleGroup } from '../types/models';
import { defaultWeekdays } from '../utils/schedule';
import { listExercises } from './exercises';
import { exercisesCol, newId, normalizeName, nowIso, requireUid } from './firestore';
import { mutateWorkout } from './workouts';
import type { StoredDay } from './workouts';

/**
 * Importa o catálogo básico de academia para o usuário atual.
 *
 * Idempotente: exercícios com nome já existente são ignorados, então
 * rodar de novo não duplica nem sobrescreve o que o usuário ajustou.
 *
 * @returns quantos exercícios foram efetivamente criados
 */
export async function importStarterExercises(): Promise<number> {
  const uid = requireUid();

  try {
    const existing = new Set((await listExercises()).map((item) => normalizeName(item.name)));
    const missing = STARTER_EXERCISES.filter((item) => !existing.has(normalizeName(item.name)));
    if (missing.length === 0) return 0;

    // Um lote só (são ~43 itens, abaixo do limite de 500 do Firestore):
    // ou o catálogo inteiro entra, ou nada entra.
    const batch = writeBatch(db);
    const now = nowIso();
    for (const item of missing) {
      batch.set(doc(exercisesCol(uid)), {
        user_id: uid,
        name: item.name,
        description: item.description,
        muscle_group: item.muscle_group,
        youtube_video_id: null,
        created_at: now,
        updated_at: now,
      });
    }
    await batch.commit();

    return missing.length;
  } catch (error) {
    throw toAppError(error, 'Não foi possível importar o catálogo.');
  }
}

/**
 * Monta a divisão da ficha automaticamente.
 *
 * Para cada grupo do dia, escolhe até `exercisesPerGroup` exercícios
 * do catálogo, em ordem alfabética. Séries, repetições e descanso
 * recebem valores iniciais padrão (3×10-12, 60s). A CARGA fica null
 * de propósito: o sistema não tem como saber quanto você levanta.
 *
 * Recusa gerar sobre uma ficha que já tenha dias: substituí-los
 * apagaria as sessões e o histórico de cargas daquele ciclo.
 *
 * @returns quantos exercícios foram prescritos ao todo. Um número
 *          menor que o esperado significa que o catálogo não tinha
 *          exercícios suficientes de algum grupo.
 */
export async function generateWorkoutPlan(input: GeneratePlanInput): Promise<number> {
  const perGroup = input.exercisesPerGroup;
  if (!Number.isInteger(perGroup) || perGroup < 1 || perGroup > 10) {
    throw new AppError('validation', 'Informe entre 1 e 10 exercícios por grupo muscular.');
  }
  if (input.days.length === 0) {
    throw new AppError('validation', 'Informe ao menos um dia de treino.');
  }
  if (input.days.length > 7) {
    throw new AppError('validation', 'Uma ficha pode ter no máximo 7 dias.');
  }
  for (const day of input.days) {
    const unknown = day.groups.find((group) => !(MUSCLE_GROUPS as readonly string[]).includes(group));
    if (unknown) throw new AppError('validation', `Grupo muscular desconhecido: ${unknown}`);
  }

  const catalog = await listExercises();
  const byGroup = new Map<MuscleGroup, typeof catalog>();
  for (const exercise of catalog) {
    const list = byGroup.get(exercise.muscle_group);
    if (list) list.push(exercise);
    else byGroup.set(exercise.muscle_group, [exercise]);
  }

  return mutateWorkout(input.workoutId, 'Não foi possível gerar a ficha.', (workout) => {
    if (workout.days.length > 0) {
      throw new AppError(
        'conflict',
        'Esta ficha já tem dias cadastrados. Gere a divisão em uma ficha nova.',
      );
    }

    const now = nowIso();
    let total = 0;

    workout.days = input.days.map((spec, index): StoredDay => {
      const dayId = newId();
      const used = new Set<string>();
      const exercises: StoredDay['exercises'] = [];

      for (const group of spec.groups) {
        // `listExercises` já devolve em ordem alfabética.
        const picks = (byGroup.get(group) ?? [])
          .filter((exercise) => !used.has(exercise.id))
          .slice(0, perGroup);

        for (const exercise of picks) {
          used.add(exercise.id);
          exercises.push({
            id: newId(),
            workout_day_id: dayId,
            exercise_id: exercise.id,
            sets: 3,
            repetitions: '10-12',
            weight: null,
            rest_seconds: 60,
            notes: null,
            // Numeração contínua entre os grupos do mesmo dia.
            exercise_order: exercises.length + 1,
            created_at: now,
            updated_at: now,
          });
        }
      }

      total += exercises.length;

      return {
        id: dayId,
        workout_id: input.workoutId,
        name: spec.name.trim() || `Dia ${index + 1}`,
        focus: spec.focus.trim() || null,
        day_order: index + 1,
        weekdays: defaultWeekdays(input.days.length, index),
        created_at: now,
        updated_at: now,
        exercises,
      };
    });

    return total;
  });
}

/**
 * Quantos exercícios o usuário tem por grupo muscular.
 *
 * Usado pela tela de geração para mostrar, ANTES de gerar, quantos
 * exercícios existem de cada grupo escolhido.
 */
export async function countExercisesByGroup(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const exercise of await listExercises()) {
    counts[exercise.muscle_group] = (counts[exercise.muscle_group] ?? 0) + 1;
  }
  return counts;
}
