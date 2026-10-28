/**
 * Hooks de geração automática.
 *
 * Gerar mexe em catálogo, dias e prescrições de uma vez só, então
 * as mutações invalidam largo — é mais barato rebuscar do que
 * arriscar deixar alguma tela desatualizada.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import * as generatorService from '../services/generator';
import type { GeneratePlanInput } from '../types/models';

/** Quantos exercícios o usuário tem em cada grupo muscular. */
export function useExerciseCountsByGroup() {
  return useQuery({
    queryKey: queryKeys.exercises.countsByGroup(),
    queryFn: generatorService.countExercisesByGroup,
  });
}

export function useImportStarterExercises() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: generatorService.importStarterExercises,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.exercises.all });
    },
  });
}

export function useGenerateWorkoutPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GeneratePlanInput) => generatorService.generateWorkoutPlan(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all });
    },
  });
}
