/**
 * Hooks de fichas, dias e prescrições.
 *
 * Cada mutação invalida exatamente as chaves afetadas. É isso que
 * garante o requisito de "interface atualizada" no fim do fluxo:
 * depois de salvar, o TanStack Query rebusca do Firestore em vez de
 * mexer no estado local e fingir que deu certo.
 *
 * Quase tudo aqui invalida `workouts.all` em vez de só o detalhe:
 * mexer num dia muda a contagem de exercícios que aparece no card
 * da listagem, então as duas telas precisam ser rebuscadas.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import * as workoutsService from '../services/workouts';
import type {
  DuplicateWorkoutInput,
  WorkoutDayInput,
  WorkoutExerciseInput,
  WorkoutInput,
} from '../types/models';

export function useWorkouts() {
  return useQuery({
    queryKey: queryKeys.workouts.list(),
    queryFn: workoutsService.listWorkouts,
  });
}

/** O ciclo ativo de hoje, ou null se não houver nenhum. */
export function useActiveWorkout() {
  return useQuery({
    queryKey: queryKeys.workouts.active(),
    queryFn: workoutsService.getActiveWorkout,
  });
}

export function useWorkout(workoutId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.workouts.detail(workoutId ?? ''),
    queryFn: () => workoutsService.getWorkout(workoutId as string),
    enabled: Boolean(workoutId),
  });
}

export function useCreateWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: WorkoutInput) => workoutsService.createWorkout(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all });
    },
  });
}

export function useUpdateWorkout(workoutId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: WorkoutInput) => workoutsService.updateWorkout(workoutId, input),
    onSuccess: () => {
      // Mudar as datas pode alterar o status do ciclo, e com ele
      // qual ficha é a "ativa" no dashboard.
      void queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all });
    },
  });
}

/** Encerra o ciclo manualmente. Não apaga nada. */
export function useCompleteWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workoutId: string) => workoutsService.completeWorkout(workoutId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
    },
  });
}

export function useReopenWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workoutId: string) => workoutsService.reopenWorkout(workoutId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all });
    },
  });
}

export function useDuplicateWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DuplicateWorkoutInput) => workoutsService.duplicateWorkout(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all });
    },
  });
}

export function useDeleteWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workoutId: string) => workoutsService.deleteWorkout(workoutId),
    onSuccess: () => {
      // Excluir a ficha leva junto dias, sessões e execuções
      // (CASCADE), então o acompanhamento também é rebuscado.
      void queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.progress.all });
    },
  });
}

// ---------------------------------------------------------------
// Dias da divisão
// ---------------------------------------------------------------

export function useCreateWorkoutDay(workoutId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: WorkoutDayInput) =>
      workoutsService.createWorkoutDay(workoutId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all });
    },
  });
}

export function useUpdateWorkoutDay(workoutId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { dayId: string; input: WorkoutDayInput }) =>
      workoutsService.updateWorkoutDay(workoutId, params.dayId, params.input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
    },
  });
}

export function useDeleteWorkoutDay(workoutId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dayId: string) => workoutsService.deleteWorkoutDay(workoutId, dayId),
    onSuccess: () => {
      // Excluir um dia leva junto as sessões dele, então o
      // acompanhamento muda.
      void queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.progress.all });
    },
  });
}

/** Reordenação de dias com atualização otimista. */
export function useReorderDays(workoutId: string) {
  const queryClient = useQueryClient();
  const detailKey = queryKeys.workouts.detail(workoutId);

  return useMutation({
    mutationFn: (orderedIds: string[]) => workoutsService.reorderDays(workoutId, orderedIds),

    onMutate: async (orderedIds: string[]) => {
      await queryClient.cancelQueries({ queryKey: detailKey });
      const previous = queryClient.getQueryData(detailKey);

      queryClient.setQueryData(detailKey, (current: unknown) => {
        if (!current || typeof current !== 'object') return current;
        const workout = current as { days: { id: string }[] };
        const byId = new Map(workout.days.map((day) => [day.id, day]));
        return {
          ...workout,
          days: orderedIds
            .map((id, index) => {
              const day = byId.get(id);
              return day ? { ...day, day_order: index + 1 } : null;
            })
            .filter(Boolean),
        };
      });

      return { previous };
    },

    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(detailKey, context.previous);
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: detailKey });
    },
  });
}

// ---------------------------------------------------------------
// Exercícios dentro do dia
// ---------------------------------------------------------------

export function useAddExerciseToDay(workoutId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { dayId: string; input: WorkoutExerciseInput }) =>
      workoutsService.addExerciseToDay(workoutId, params.dayId, params.input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all });
    },
  });
}

export function useUpdatePrescription(workoutId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      prescriptionId: string;
      input: Omit<WorkoutExerciseInput, 'exercise_id'>;
    }) => workoutsService.updatePrescription(workoutId, params.prescriptionId, params.input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workouts.detail(workoutId) });
    },
  });
}

export function useRemoveExerciseFromDay(workoutId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (prescriptionId: string) =>
      workoutsService.removeExerciseFromDay(workoutId, prescriptionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all });
    },
  });
}

/**
 * Reordenação de exercícios dentro de um dia, com atualização
 * otimista.
 *
 * Aqui a exceção vale a pena: mover um item precisa parecer
 * instantâneo. Pintamos a nova ordem antes da resposta e, se o
 * servidor recusar, `onError` restaura o estado anterior.
 */
export function useReorderExercises(workoutId: string, dayId: string) {
  const queryClient = useQueryClient();
  const detailKey = queryKeys.workouts.detail(workoutId);

  return useMutation({
    mutationFn: (orderedIds: string[]) =>
      workoutsService.reorderExercises(workoutId, dayId, orderedIds),

    onMutate: async (orderedIds: string[]) => {
      await queryClient.cancelQueries({ queryKey: detailKey });
      const previous = queryClient.getQueryData(detailKey);

      queryClient.setQueryData(detailKey, (current: unknown) => {
        if (!current || typeof current !== 'object') return current;
        const workout = current as { days: { id: string; exercises: { id: string }[] }[] };

        return {
          ...workout,
          days: workout.days.map((day) => {
            if (day.id !== dayId) return day;
            const byId = new Map(day.exercises.map((item) => [item.id, item]));
            return {
              ...day,
              exercises: orderedIds
                .map((id, index) => {
                  const item = byId.get(id);
                  return item ? { ...item, exercise_order: index + 1 } : null;
                })
                .filter(Boolean),
            };
          }),
        };
      });

      return { previous };
    },

    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(detailKey, context.previous);
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: detailKey });
    },
  });
}
