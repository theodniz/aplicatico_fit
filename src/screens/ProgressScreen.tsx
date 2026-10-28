import styled from 'styled-components/native';
import { useExerciseProgress } from '../hooks/useProgress';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState, Loading } from '../components/ui/Feedback';
import { Screen } from '../components/ui/Screen';
import { useAppNavigation } from '../navigation/types';
import { getErrorMessage } from '../lib/errors';
import { space } from '../theme/theme';
import { ProgressRow } from './CycleSummaryScreen';

/**
 * Evolução de carga de todos os exercícios, atravessando ciclos.
 *
 * Sem filtro por ficha, a consulta pega o histórico inteiro do
 * usuário. Isso funciona porque duplicar uma ficha cria prescrições
 * novas mas reaproveita o mesmo registro de exercício — o "Supino
 * Reto" do Ciclo 1 e o do Ciclo 3 são o mesmo `exercise_id`.
 */
export default function ProgressScreen() {
  const navigation = useAppNavigation();
  const { data: progress, isPending, isError, error, refetch, isRefetching } = useExerciseProgress();

  if (isPending) return <Loading message="Carregando evolução…" fullScreen />;

  if (isError) {
    return (
      <Screen>
        <ErrorState
          message={getErrorMessage(error, 'Não foi possível carregar sua evolução.')}
          action={
            <Button variant="secondary" onPress={() => void refetch()}>
              Tentar novamente
            </Button>
          }
        />
      </Screen>
    );
  }

  const performed = progress ?? [];

  return (
    <Screen subtitle="Histórico de cargas por exercício" onRefresh={() => void refetch()} refreshing={isRefetching}>
      {performed.length === 0 ? (
        <EmptyState
          title="Nenhum treino registrado ainda"
          message="Conclua treinos com carga registrada para acompanhar sua evolução aqui."
          icon="stats-chart-outline"
          action={<Button onPress={() => navigation.navigate('Tabs', { screen: 'Cycles' })}>Ver minhas fichas</Button>}
        />
      ) : (
        <List>
          {performed.map((item) => (
            <ProgressRow key={item.exerciseId} item={item} detailed />
          ))}
        </List>
      )}
    </Screen>
  );
}

const List = styled.View`
  gap: ${space(2)};
`;
