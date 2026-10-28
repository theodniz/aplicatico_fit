import { useLayoutEffect, useState } from 'react';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import styled, { useTheme } from 'styled-components/native';
import {
  useCompleteWorkout,
  useDeleteWorkout,
  useReopenWorkout,
  useUpdatePrescription,
  useWorkout,
} from '../hooks/useWorkouts';
import { useInProgressSession, useStartSession } from '../hooks/useSessions';
import { useToast } from '../contexts/ToastContext';
import { CycleBadge } from '../components/domain/Cycle';
import { VideoToggle } from '../components/domain/VideoPlayer';
import { Button, ButtonCell, ButtonRow } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Form, Input } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import { EmptyState, ErrorState, Loading, Notice } from '../components/ui/Feedback';
import { Screen } from '../components/ui/Screen';
import { Tag, Wrap } from '../components/ui/Typography';
import { muscleGroupLabel } from '../constants/muscleGroups';
import { formatRest, formatWeight, pluralize } from '../utils/format';
import { computeStatus, describeRemaining, formatPeriod } from '../utils/cycle';
import { describeWeekdays } from '../utils/schedule';
import { getErrorMessage } from '../lib/errors';
import type { WorkoutDay, WorkoutExercise } from '../types/models';
import type { RootScreenProps } from '../navigation/types';
import { color, font, radius, space } from '../theme/theme';

/**
 * Consulta da ficha.
 *
 * Os dias vêm colapsados: com 4 dias de 6 exercícios, abrir tudo
 * daria uma lista de 24 itens em que nada se acha. O dia expande
 * ao toque, e apenas um fica aberto por vez.
 *
 * Cada dia tem o próprio botão de iniciar treino, porque uma sessão
 * executa UM dia — "treinei segunda" significa "fiz o Dia 1".
 */
export default function WorkoutScreen({ navigation, route }: RootScreenProps<'Workout'>) {
  const { workoutId } = route.params;
  const theme = useTheme();
  const toast = useToast();

  const { data: workout, isPending, isError, error, refetch, isRefetching } = useWorkout(workoutId);
  const { data: activeSession } = useInProgressSession();

  const startSession = useStartSession();
  const completeWorkout = useCompleteWorkout();
  const reopenWorkout = useReopenWorkout();
  const deleteWorkout = useDeleteWorkout();
  const updatePrescription = useUpdatePrescription(workoutId);

  // ----- Carga editada direto no card -----
  const [loadTarget, setLoadTarget] = useState<WorkoutExercise | null>(null);
  const [loadDraft, setLoadDraft] = useState('');
  const [loadError, setLoadError] = useState<string | undefined>();

  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useLayoutEffect(() => {
    if (workout) navigation.setOptions({ title: workout.name });
  }, [navigation, workout]);

  if (isPending) return <Loading message="Carregando ficha…" fullScreen />;

  if (isError || !workout) {
    return (
      <Screen>
        <ErrorState
          message={getErrorMessage(error, 'Não foi possível carregar esta ficha.')}
          action={
            <Button variant="secondary" onPress={() => void refetch()}>
              Tentar novamente
            </Button>
          }
        />
      </Screen>
    );
  }

  const status = computeStatus(workout);
  const totalExercises = workout.days.reduce((sum, day) => sum + day.exercises.length, 0);

  const handleStart = async (day: WorkoutDay) => {
    if (day.exercises.length === 0) {
      toast.showError('Adicione exercícios a este dia antes de treinar.');
      navigation.navigate('CycleEditor', { workoutId });
      return;
    }

    try {
      const sessionId = await startSession.mutateAsync({ workoutId, dayId: day.id });
      navigation.navigate('Session', { sessionId });
    } catch (caught) {
      toast.showError(getErrorMessage(caught, 'Não foi possível iniciar o treino.'));
    }
  };

  const handleComplete = async () => {
    try {
      await completeWorkout.mutateAsync(workoutId);
      toast.showSuccess('Ciclo encerrado. Os dados continuam disponíveis para consulta.');
    } catch (caught) {
      toast.showError(getErrorMessage(caught, 'Não foi possível encerrar o ciclo.'));
    } finally {
      setConfirmComplete(false);
    }
  };

  const handleReopen = async () => {
    try {
      await reopenWorkout.mutateAsync(workoutId);
      toast.showSuccess('Ciclo reaberto.');
    } catch (caught) {
      // Erro típico: o período colide com outro ciclo criado depois.
      toast.showError(getErrorMessage(caught, 'Não foi possível reabrir o ciclo.'));
    }
  };

  const openLoad = (item: WorkoutExercise) => {
    setLoadTarget(item);
    setLoadDraft(item.weight === null ? '' : String(item.weight).replace('.', ','));
    setLoadError(undefined);
  };

  const handleSaveLoad = async () => {
    if (!loadTarget) return;

    // Mesma regra do editor da ficha: vazio = sem carga definida.
    const text = loadDraft.trim().replace(',', '.');
    const weight = text ? Number(text) : null;
    if (weight !== null && (Number.isNaN(weight) || weight < 0 || weight > 9999)) {
      setLoadError('Informe uma carga válida, em kg.');
      return;
    }

    try {
      await updatePrescription.mutateAsync({
        prescriptionId: loadTarget.id,
        input: {
          sets: loadTarget.sets,
          repetitions: loadTarget.repetitions,
          weight,
          rest_seconds: loadTarget.rest_seconds,
          notes: loadTarget.notes,
        },
      });
      toast.showSuccess('Carga atualizada.');
      setLoadTarget(null);
    } catch (caught) {
      setLoadError(getErrorMessage(caught, 'Não foi possível salvar a carga.'));
    }
  };

  const handleDelete = async () => {
    try {
      await deleteWorkout.mutateAsync(workoutId);
      toast.showSuccess('Ficha excluída.');
      navigation.goBack();
    } catch (caught) {
      toast.showError(getErrorMessage(caught, 'Não foi possível excluir a ficha.'));
      setConfirmDelete(false);
    }
  };

  return (
    <Screen subtitle={workout.description ?? undefined} onRefresh={() => void refetch()} refreshing={isRefetching}>
      <Wrap>
        <CycleBadge status={status} />
        <Tag>{formatPeriod(workout)}</Tag>
        <Tag>{describeRemaining(workout, status)}</Tag>
      </Wrap>

      {workout.days.length > 0 && (
        <Summary>
          <Tag>{pluralize(workout.days.length, 'dia', 'dias')}</Tag>
          <Tag>{pluralize(totalExercises, 'exercício', 'exercícios')}</Tag>
        </Summary>
      )}

      <Gap />

      {(status === 'expired' || status === 'completed') && (
        <Notice>
          Ciclo finalizado. Não é possível iniciar novos treinos nesta ficha, mas todos os dados continuam
          disponíveis para consulta.
        </Notice>
      )}

      {status === 'upcoming' && <Notice>{`Este ciclo ainda não começou. ${describeRemaining(workout, status)}.`}</Notice>}

      <Gap />

      {workout.days.length === 0 ? (
        <EmptyState
          title="Ficha sem divisão"
          message="Monte os dias de treino para poder começar. Você pode gerar a divisão automaticamente."
          action={
            <>
              <Button onPress={() => navigation.navigate('CycleGenerator', { workoutId })}>Gerar divisão</Button>
              <Button variant="secondary" onPress={() => navigation.navigate('CycleEditor', { workoutId })}>
                Montar manualmente
              </Button>
            </>
          }
        />
      ) : (
        <DayList>
          {workout.days.map((day) => {
            const resumable = activeSession?.workout_day_id === day.id ? activeSession : null;
            const expanded = expandedDay === day.id;

            return (
              <DayCard key={day.id}>
                <DayToggle
                  onPress={() => setExpandedDay(expanded ? null : day.id)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                >
                  <DayTitles>
                    <DayName>{day.name}</DayName>
                    {day.focus ? <DayFocus>{day.focus}</DayFocus> : null}
                    <DayCount>
                      {`${day.weekdays.length > 0 ? `${describeWeekdays(day.weekdays)} · ` : ''}${pluralize(day.exercises.length, 'exercício', 'exercícios')}`}
                    </DayCount>
                  </DayTitles>
                  <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={theme.colors.textMuted}
                  />
                </DayToggle>

                {status === 'active' &&
                  (resumable ? (
                    <Button fullWidth onPress={() => navigation.navigate('Session', { sessionId: resumable.id })}>
                      {`Continuar ${day.name}`}
                    </Button>
                  ) : (
                    <Button
                      fullWidth
                      onPress={() => void handleStart(day)}
                      loading={startSession.isPending}
                      disabled={day.exercises.length === 0 || Boolean(activeSession)}
                    >
                      {activeSession ? 'Você tem outro treino em andamento' : `Iniciar ${day.name}`}
                    </Button>
                  ))}

                {expanded && (
                  <ExerciseList>
                    {day.exercises.map((item) => (
                      <ExerciseCard key={item.id} item={item} onEditLoad={() => openLoad(item)} />
                    ))}
                    {day.exercises.length === 0 && <Notice>Nenhum exercício neste dia ainda.</Notice>}
                  </ExerciseList>
                )}
              </DayCard>
            );
          })}
        </DayList>
      )}

      <Actions>
        <ButtonRow>
          <ButtonCell>
            <Button variant="secondary" fullWidth onPress={() => navigation.navigate('CycleSummary', { workoutId })}>
              Acompanhamento
            </Button>
          </ButtonCell>
          <ButtonCell>
            <Button variant="secondary" fullWidth onPress={() => navigation.navigate('CycleEditor', { workoutId })}>
              Editar ficha
            </Button>
          </ButtonCell>
        </ButtonRow>

        <ButtonRow>
          <ButtonCell>
            <Button
              variant="ghost"
              fullWidth
              onPress={() => navigation.navigate('CycleForm', { duplicateFrom: workoutId })}
            >
              Duplicar
            </Button>
          </ButtonCell>
          {status === 'completed' && (
            <ButtonCell>
              <Button variant="ghost" fullWidth onPress={() => void handleReopen()} loading={reopenWorkout.isPending}>
                Reabrir ciclo
              </Button>
            </ButtonCell>
          )}
          {status === 'active' && (
            <ButtonCell>
              <Button variant="ghost" fullWidth onPress={() => setConfirmComplete(true)}>
                Encerrar ciclo
              </Button>
            </ButtonCell>
          )}
        </ButtonRow>

        <Button variant="dangerOutline" fullWidth onPress={() => setConfirmDelete(true)}>
          Excluir ficha
        </Button>
      </Actions>

      <Modal
        open={loadTarget !== null}
        onClose={() => setLoadTarget(null)}
        title={loadTarget ? `Carga · ${loadTarget.exercise.name}` : 'Carga'}
        busy={updatePrescription.isPending}
      >
        <Form>
          <Input
            label="Carga (kg)"
            value={loadDraft}
            onChangeText={(text) => {
              setLoadDraft(text);
              setLoadError(undefined);
            }}
            error={loadError}
            placeholder="30"
            hint="Vale para os próximos treinos. Vazio: sem carga definida."
            keyboardType="decimal-pad"
            disabled={updatePrescription.isPending}
          />
          <ButtonRow>
            <ButtonCell>
              <Button
                variant="secondary"
                fullWidth
                onPress={() => setLoadTarget(null)}
                disabled={updatePrescription.isPending}
              >
                Cancelar
              </Button>
            </ButtonCell>
            <ButtonCell>
              <Button fullWidth onPress={() => void handleSaveLoad()} loading={updatePrescription.isPending}>
                {updatePrescription.isPending ? 'Salvando…' : 'Salvar'}
              </Button>
            </ButtonCell>
          </ButtonRow>
        </Form>
      </Modal>

      <ConfirmDialog
        open={confirmComplete}
        title="Encerrar ciclo"
        message="O ciclo será marcado como encerrado e deixará de aceitar novos treinos. Nada é apagado: dias, exercícios, sessões e histórico continuam disponíveis. Você pode reabri-lo depois."
        confirmLabel="Encerrar"
        destructive={false}
        loading={completeWorkout.isPending}
        onConfirm={() => void handleComplete()}
        onCancel={() => setConfirmComplete(false)}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Excluir ficha"
        message={`Excluir "${workout.name}" apaga também os dias, todas as sessões e o histórico de cargas deste ciclo. Esta ação não pode ser desfeita. Para preservar os dados, encerre o ciclo em vez de excluí-lo.`}
        loading={deleteWorkout.isPending}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </Screen>
  );
}

function ExerciseCard({ item, onEditLoad }: { item: WorkoutExercise; onEditLoad: () => void }) {
  const theme = useTheme();
  const { exercise } = item;

  return (
    <ExerciseBox accessibilityLabel={`Exercício ${item.exercise_order}: ${exercise.name}`}>
      <ExerciseHead>
        <OrderCircle>
          <OrderText>{item.exercise_order}</OrderText>
        </OrderCircle>
        <ExerciseTitles>
          <ExerciseName>{exercise.name}</ExerciseName>
          <Tag>{muscleGroupLabel(exercise.muscle_group)}</Tag>
        </ExerciseTitles>
      </ExerciseHead>

      <Metrics>
        <Metric>
          <MetricLabel>Séries</MetricLabel>
          <MetricValue>{item.sets}</MetricValue>
        </Metric>
        <Metric>
          <MetricLabel>Reps</MetricLabel>
          <MetricValue>{item.repetitions}</MetricValue>
        </Metric>
        {/* Tocável: definir a carga direto aqui, sem abrir o editor da ficha. */}
        <Metric
          as={Pressable}
          $accent
          onPress={onEditLoad}
          accessibilityRole="button"
          accessibilityLabel={`Carga de ${exercise.name}: ${formatWeight(item.weight)}. Toque para alterar.`}
        >
          <LoadLabelRow>
            <MetricLabel>Carga</MetricLabel>
            <Ionicons name="create-outline" size={11} color={theme.colors.accent} />
          </LoadLabelRow>
          <MetricValue $small={item.weight === null} $accent>
            {item.weight === null ? 'Definir' : formatWeight(item.weight)}
          </MetricValue>
        </Metric>
      </Metrics>

      {item.rest_seconds !== null && (
        <InfoRow>
          <Ionicons name="timer-outline" size={15} color={theme.colors.textMuted} />
          <InfoText>
            Descanso <InfoStrong>{formatRest(item.rest_seconds)}</InfoStrong>
          </InfoText>
        </InfoRow>
      )}

      {item.notes ? (
        <NotesBox>
          <Ionicons name="information-circle-outline" size={15} color={theme.colors.warning} />
          <NotesText>{item.notes}</NotesText>
        </NotesBox>
      ) : null}

      {exercise.description ? <Description>{exercise.description}</Description> : null}

      {exercise.youtube_video_id ? (
        <VideoToggle videoId={exercise.youtube_video_id} exerciseName={exercise.name} />
      ) : null}
    </ExerciseBox>
  );
}

const Summary = styled.View`
  flex-direction: row;
  gap: ${space(2)};
  margin-top: ${space(2)};
`;

const Gap = styled.View`
  height: ${space(3)};
`;

const DayList = styled.View`
  gap: ${space(3)};
`;

const DayCard = styled.View`
  gap: ${space(3)};
  padding: ${space(4)};
  border-radius: ${radius('lg')};
  border-width: 1px;
  border-color: ${color('border')};
  background-color: ${color('surface')};
`;

const DayToggle = styled.Pressable`
  flex-direction: row;
  align-items: center;
  gap: ${space(3)};
`;

const DayTitles = styled.View`
  flex: 1;
  gap: 2px;
`;

const DayName = styled.Text`
  color: ${color('text')};
  font-size: ${font('lg')};
  font-weight: 700;
`;

const DayFocus = styled.Text`
  color: ${color('textMuted')};
  font-size: ${font('sm')};
`;

const DayCount = styled.Text`
  color: ${color('textSubtle')};
  font-size: ${font('xs')};
`;

const ExerciseList = styled.View`
  gap: ${space(3)};
`;

const ExerciseBox = styled.View`
  gap: ${space(3)};
  padding: ${space(4)};
  border-radius: ${radius('md')};
  background-color: ${color('bg')};
  border-width: 1px;
  border-color: ${color('border')};
`;

const ExerciseHead = styled.View`
  flex-direction: row;
  align-items: center;
  gap: ${space(3)};
`;

const OrderCircle = styled.View`
  width: 32px;
  height: 32px;
  border-radius: 16px;
  align-items: center;
  justify-content: center;
  background-color: ${color('accentSoft')};
`;

const OrderText = styled.Text`
  color: ${color('accent')};
  font-weight: 800;
`;

const ExerciseTitles = styled.View`
  flex: 1;
  gap: ${space(1)};
`;

const ExerciseName = styled.Text`
  color: ${color('text')};
  font-size: ${font('base')};
  font-weight: 700;
`;

const Metrics = styled.View`
  flex-direction: row;
  gap: ${space(2)};
`;

const Metric = styled.View<{ $accent?: boolean }>`
  flex: 1;
  align-items: center;
  padding: ${space(3)} ${space(2)};
  border-radius: ${radius('md')};
  background-color: ${({ theme, $accent }) => ($accent ? theme.colors.accentSoft : theme.colors.surfaceRaised)};
`;

const LoadLabelRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 3px;
`;

const MetricLabel = styled.Text`
  color: ${color('textSubtle')};
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
`;

const MetricValue = styled.Text<{ $small?: boolean; $accent?: boolean }>`
  color: ${({ theme, $accent }) => ($accent ? theme.colors.accent : theme.colors.text)};
  font-size: ${({ $small }) => ($small ? '14px' : '20px')};
  font-weight: 800;
  margin-top: 2px;
`;

const InfoRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: ${space(2)};
`;

const InfoText = styled.Text`
  color: ${color('textMuted')};
  font-size: ${font('sm')};
`;

const InfoStrong = styled.Text`
  color: ${color('text')};
  font-weight: 700;
`;

const NotesBox = styled.View`
  flex-direction: row;
  gap: ${space(2)};
  padding: ${space(3)};
  border-radius: ${radius('sm')};
  background-color: ${color('warningSoft')};
`;

const NotesText = styled.Text`
  flex: 1;
  color: ${color('text')};
  font-size: ${font('sm')};
  line-height: 20px;
`;

const Description = styled.Text`
  color: ${color('textMuted')};
  font-size: ${font('sm')};
  line-height: 20px;
`;

const Actions = styled.View`
  gap: ${space(3)};
  margin-top: ${space(6)};
`;
