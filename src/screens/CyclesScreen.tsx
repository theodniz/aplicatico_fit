import { useMemo } from 'react';
import styled from 'styled-components/native';
import { useWorkouts } from '../hooks/useWorkouts';
import { CycleCard } from '../components/domain/Cycle';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState, Loading } from '../components/ui/Feedback';
import { Screen } from '../components/ui/Screen';
import { Section, SectionTitle } from '../components/ui/Typography';
import { useAppNavigation } from '../navigation/types';
import { getErrorMessage } from '../lib/errors';
import type { WorkoutSummary } from '../types/models';
import { space } from '../theme/theme';

/**
 * Minhas fichas.
 *
 * Fichas antigas NUNCA são apagadas automaticamente — elas são o
 * histórico do usuário. A tela agrupa por estado para que o ciclo
 * atual apareça primeiro e o passado fique acessível abaixo, sem
 * competir por atenção.
 */
export default function CyclesScreen() {
  const navigation = useAppNavigation();
  const { data: workouts, isPending, isError, error, refetch, isRefetching } = useWorkouts();

  const groups = useMemo(() => {
    const all = workouts ?? [];
    return {
      active: all.filter((w) => w.status === 'active'),
      upcoming: all.filter((w) => w.status === 'upcoming'),
      // Encerrado manualmente e expirado por data são estados
      // diferentes, mas para o usuário ambos são "passado". O selo
      // dentro do card mantém a distinção visível.
      past: all.filter((w) => w.status === 'completed' || w.status === 'expired'),
    };
  }, [workouts]);

  const open = (workout: WorkoutSummary) => navigation.navigate('Workout', { workoutId: workout.id });

  return (
    <Screen
      subtitle="Ciclos de treino, do atual ao histórico"
      action={
        <Button size="sm" onPress={() => navigation.navigate('CycleForm')}>
          Nova
        </Button>
      }
      onRefresh={() => void refetch()}
      refreshing={isRefetching}
    >
      {isPending && <Loading message="Carregando fichas…" />}

      {isError && (
        <ErrorState
          message={getErrorMessage(error, 'Não foi possível carregar suas fichas.')}
          action={
            <Button variant="secondary" onPress={() => void refetch()}>
              Tentar novamente
            </Button>
          }
        />
      )}

      {!isPending && !isError && workouts?.length === 0 && (
        <EmptyState
          title="Nenhuma ficha ainda"
          message="Crie seu primeiro ciclo com data de início e término para começar a registrar treinos."
          icon="document-text-outline"
          action={<Button onPress={() => navigation.navigate('CycleForm')}>Criar ficha</Button>}
        />
      )}

      <CycleGroup title="Ciclo atual" workouts={groups.active} onOpen={open} />
      <CycleGroup title="Próximos" workouts={groups.upcoming} onOpen={open} />
      <CycleGroup title="Histórico" workouts={groups.past} onOpen={open} />
    </Screen>
  );
}

function CycleGroup({
  title,
  workouts,
  onOpen,
}: {
  title: string;
  workouts: WorkoutSummary[];
  onOpen: (workout: WorkoutSummary) => void;
}) {
  if (workouts.length === 0) return null;

  return (
    <Section>
      <SectionTitle>{title}</SectionTitle>
      <List>
        {workouts.map((workout) => (
          <CycleCard key={workout.id} workout={workout} onPress={() => onOpen(workout)} />
        ))}
      </List>
    </Section>
  );
}

const List = styled.View`
  gap: ${space(3)};
`;
