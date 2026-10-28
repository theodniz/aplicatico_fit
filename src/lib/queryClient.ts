import { QueryClient } from '@tanstack/react-query';
import { AppError } from './errors';

/**
 * Configuração do cache de dados.
 *
 * O contexto de uso manda aqui: o app é consultado dentro da
 * academia, muitas vezes com sinal ruim. Vale mais reaproveitar
 * dados recentes do que insistir em rebuscar tudo — e cada leitura
 * conta contra a cota gratuita do Firestore.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Fichas mudam raramente. 5 minutos evita refetch a cada troca
      // de tela.
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,

      // No React Native não há "foco de janela"; a revalidação vem do
      // puxar-para-atualizar das telas e da invalidação pós-mutação.
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,

      retry: (failureCount, error) => {
        // Erro de permissão ou registro inexistente não melhora
        // tentando de novo — só atrasa a mensagem para o usuário.
        if (error instanceof AppError) {
          if (['permission', 'not_found', 'auth', 'validation'].includes(error.kind)) {
            return false;
          }
        }
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    },
    mutations: {
      // Escrita não é reexecutada automaticamente: repetir um
      // "excluir" às cegas é pior do que mostrar o erro.
      retry: false,
    },
  },
});

/**
 * Chaves de cache centralizadas.
 *
 * Manter as chaves aqui é o que faz a invalidação depois de uma
 * mutação ser confiável — string solta em cada arquivo é receita
 * para tela desatualizada depois de salvar.
 */
export const queryKeys = {
  workouts: {
    all: ['workouts'] as const,
    list: () => [...queryKeys.workouts.all, 'list'] as const,
    active: () => [...queryKeys.workouts.all, 'active'] as const,
    detail: (id: string) => [...queryKeys.workouts.all, 'detail', id] as const,
  },
  exercises: {
    all: ['exercises'] as const,
    list: () => [...queryKeys.exercises.all, 'list'] as const,
    countsByGroup: () => [...queryKeys.exercises.all, 'counts-by-group'] as const,
  },
  sessions: {
    all: ['sessions'] as const,
    inProgress: () => [...queryKeys.sessions.all, 'in-progress'] as const,
    detail: (id: string) => [...queryKeys.sessions.all, 'detail', id] as const,
    history: (workoutId: string) => [...queryKeys.sessions.all, 'history', workoutId] as const,
    week: () => [...queryKeys.sessions.all, 'week'] as const,
  },
  progress: {
    all: ['progress'] as const,
    cycleStats: (workoutId: string) => [...queryKeys.progress.all, 'cycle', workoutId] as const,
    // `workoutId` opcional: sem ele, a evolução considera todo o
    // histórico do usuário, atravessando ciclos.
    exercises: (workoutId?: string) =>
      [...queryKeys.progress.all, 'exercises', workoutId ?? 'all'] as const,
    loadHistory: (exerciseId: string) =>
      [...queryKeys.progress.all, 'load', exerciseId] as const,
  },
  /** Fotos de registro guardadas no próprio celular, por treino. */
  photos: ['workout-photos'] as const,
  users: {
    all: ['users'] as const,
    list: () => [...queryKeys.users.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.users.all, 'detail', id] as const,
  },
} as const;
