/**
 * Hooks das fotos de registro.
 *
 * As fotos moram no celular, não no Firestore; a consulta existe só
 * para a tela do treino e os cards da semana se atualizarem juntos
 * quando uma foto nova é tirada.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import * as photosService from '../services/photos';

/** Fotos de todos os treinos, agrupadas pelo id da sessão. */
export function useWorkoutPhotos() {
  return useQuery({
    queryKey: queryKeys.photos,
    queryFn: async () => photosService.listWorkoutPhotos(),
    // Só muda quando ESTE aparelho tira uma foto, e aí a mutação
    // abaixo invalida. Não há o que revalidar por tempo.
    staleTime: Infinity,
  });
}

export function useTakeWorkoutPhoto(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => photosService.takeWorkoutPhoto(sessionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.photos });
    },
  });
}
