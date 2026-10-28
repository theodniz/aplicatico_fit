import { useActiveWorkout } from '../hooks/useWorkouts';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState, Loading } from '../components/ui/Feedback';
import { Screen } from '../components/ui/Screen';
import { useAppNavigation } from '../navigation/types';
import { getErrorMessage } from '../lib/errors';
import { CycleAnalysis } from './CycleSummaryScreen';

/**
 * Aba Análise: o acompanhamento do ciclo ATIVO, a um toque.
 *
 * A home mostra só a semana; quem quer ver o ciclo inteiro — prazo,
 * meta, tempo de treino, evolução — vem para cá.
 */
export default function AnalysisScreen() {
  const navigation = useAppNavigation();
  const { data: activeWorkout, isPending, isError, error, refetch } = useActiveWorkout();

  if (isPending) return <Loading message="Carregando análise…" fullScreen />;

  if (isError) {
    return (
      <Screen>
        <ErrorState
          message={getErrorMessage(error, 'Não foi possível carregar o ciclo.')}
          action={
            <Button variant="secondary" onPress={() => void refetch()}>
              Tentar novamente
            </Button>
          }
        />
      </Screen>
    );
  }

  if (!activeWorkout) {
    return (
      <Screen>
        <EmptyState
          title="Nenhum ciclo ativo"
          message="A análise mostra o ciclo em andamento. Os ciclos anteriores continuam disponíveis em Fichas."
          icon="stats-chart-outline"
          action={<Button onPress={() => navigation.navigate('Tabs', { screen: 'Cycles' })}>Ver fichas</Button>}
        />
      </Screen>
    );
  }

  return <CycleAnalysis workoutId={activeWorkout.id} />;
}
