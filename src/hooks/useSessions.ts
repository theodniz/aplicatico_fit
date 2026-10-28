/**
 * Hooks de sessão de treino.
 *
 * Uma sessão só é escrita duas vezes — ao iniciar e ao finalizar —,
 * então não há atualização otimista: cada mutação invalida o que
 * depende dela e a tela relê.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import * as sessionsService from '../services/sessions';

export function useInProgressSession() {
  return useQuery({
    queryKey: queryKeys.sessions.inProgress(),
    queryFn: sessionsService.getInProgressSession,
    // O treino em andamento é o estado mais volátil do app: vale
    // revalidar com frequência para não mostrar um treino que já
    // foi finalizado em outro aparelho.
    staleTime: 30 * 1000,
  });
}

export function useSession(sessionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.sessions.detail(sessionId ?? ''),
    queryFn: () => sessionsService.getSession(sessionId as string),
    enabled: Boolean(sessionId),
  });
}

export function useSessionHistory(workoutId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.sessions.history(workoutId ?? ''),
    queryFn: () => sessionsService.listSessions(workoutId as string),
    enabled: Boolean(workoutId),
  });
}

/** Treinos iniciados nesta semana, para a programação da home. */
export function useWeekSessions() {
  return useQuery({
    queryKey: queryKeys.sessions.week(),
    queryFn: sessionsService.listWeekSessions,
  });
}

export function useStartSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { workoutId: string; dayId: string }) =>
      sessionsService.startSession(params.workoutId, params.dayId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all });
    },
  });
}

export function useCompleteSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => sessionsService.completeSession(sessionId),
    onSuccess: () => {
      // Finalizar mexe em tudo: sessão, histórico do ciclo,
      // contadores e evolução de carga.
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.progress.all });
    },
  });
}

export function useDiscardSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => sessionsService.discardSession(sessionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all });
    },
  });
}
