/**
 * Hooks de usuários (área administrativa).
 *
 * A atribuição de treinos saiu com a mudança para o modelo de
 * posse: cada usuário cria as próprias fichas, então não há mais
 * o que atribuir.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import * as usersService from '../services/users';
import type { CreateUserInput, UserRole } from '../types/models';

export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users.list(),
    queryFn: usersService.listUsers,
  });
}

export function useUser(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.users.detail(userId ?? ''),
    queryFn: () => usersService.getUser(userId as string),
    enabled: Boolean(userId),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) => usersService.createUser(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { id: string; name: string; role: UserRole }) =>
      usersService.updateUser(params.id, { name: params.name, role: params.role }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}
