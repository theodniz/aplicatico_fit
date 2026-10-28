/**
 * Hooks de acompanhamento e evolução.
 *
 * Todos são somente leitura e derivam de sessões já gravadas, então
 * o cache pode ser generoso: os números só mudam quando um treino é
 * finalizado, e essa mutação já invalida `queryKeys.progress.all`.
 */
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import * as progressService from '../services/progress';

export function useCycleStats(workoutId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.progress.cycleStats(workoutId ?? ''),
    queryFn: () => progressService.getCycleStats(workoutId as string),
    enabled: Boolean(workoutId),
  });
}

/** Sem `workoutId`, considera o histórico inteiro do usuário. */
export function useExerciseProgress(workoutId?: string) {
  return useQuery({
    queryKey: queryKeys.progress.exercises(workoutId),
    queryFn: () => progressService.getExerciseProgress(workoutId),
  });
}

export function useLoadHistory(exerciseId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.progress.loadHistory(exerciseId ?? ''),
    queryFn: () => progressService.getLoadHistory(exerciseId as string),
    enabled: Boolean(exerciseId),
  });
}
