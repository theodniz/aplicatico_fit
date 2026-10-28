/**
 * Hooks do catálogo de exercícios.
 */
import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import * as exercisesService from '../services/exercises';
import type { Exercise, ExerciseInput } from '../types/models';
import type { ExerciseFilters } from '../services/exercises';

export function useExercises(filters: ExerciseFilters = {}) {
  const { search, muscleGroup } = filters;

  // O catálogo vem inteiro numa leitura só (cacheada) e o filtro roda
  // no aparelho: digitar na busca não gera requisição nenhuma.
  const select = useCallback(
    (exercises: Exercise[]) => exercisesService.filterExercises(exercises, { search, muscleGroup }),
    [search, muscleGroup],
  );

  return useQuery({
    queryKey: queryKeys.exercises.list(),
    queryFn: exercisesService.listExercises,
    select,
  });
}

export function useCreateExercise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ExerciseInput) => exercisesService.createExercise(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.exercises.all });
    },
  });
}

export function useUpdateExercise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { id: string; input: ExerciseInput }) =>
      exercisesService.updateExercise(params.id, params.input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.exercises.all });
      // O nome e o vídeo aparecem dentro das fichas: elas também
      // precisam ser rebuscadas.
      void queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all });
    },
  });
}

export function useDeleteExercise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => exercisesService.deleteExercise(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.exercises.all });
    },
  });
}
