import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';
import styled, { useTheme } from 'styled-components/native';
import { useQueryClient } from '@tanstack/react-query';
import { useActiveWorkout, useWorkout } from '../hooks/useWorkouts';
import { useInProgressSession, useStartSession, useWeekSessions } from '../hooks/useSessions';
import { useAuth } from '../hooks/useAuth';
import { useWorkoutPhotos } from '../hooks/usePhotos';
import { useNow } from '../hooks/useNow';
import { useToast } from '../contexts/ToastContext';
import { Button } from '../components/ui/Button';
import { PhotoViewer } from '../components/domain/PhotoViewer';
import { EmptyState, ErrorState, Skeleton } from '../components/ui/Feedback';
import { Screen } from '../components/ui/Screen';
import { useAppNavigation } from '../navigation/types';
import { Tag, Wrap } from '../components/ui/Typography';
import {
  elapsedSeconds,
  firstName,
  formatClock,
  formatDuration,
  formatRest,
  formatWeight,
  pluralize,
} from '../utils/format';
import { buildWeekSchedule, formatWeekdayDate, isSameDay, toDateOnly, weekDates } from '../utils/schedule';
import { formatDateOnly } from '../utils/cycle';
import { getErrorMessage } from '../lib/errors';
import { queryKeys } from '../lib/queryClient';
import type { WeekSession, WorkoutDay } from '../types/models';
import { color, font, radius, space } from '../theme/theme';

/** Linha de exercício da semana: programado (ficha) ou feito (sessão). */
interface ExerciseItem {
  id: string;
  name: string;
  sets: number | null;
  repetitions: string | null;
  weight: number | null;
  rest: number | null;
}

/**
 * Início: a programação da semana, de segunda a domingo.
 *
 * Cada data mostra o treino que cai nela (ou descanso) e o que já
 * aconteceu — concluído com a duração, em andamento com o cronômetro.
 * Qualquer dia abre ao toque para consultar os exercícios; hoje já
 * começa aberto. O botão de iniciar aparece só no dia de hoje, que é
 * a pergunta de quem abre o app na academia: "qual é o treino de hoje?".
 */
export default function HomeScreen() {
  const theme = useTheme();
  const navigation = useAppNavigation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  const { data: activeWorkout, isPending, isError, error, refetch, isRefetching } = useActiveWorkout();
  const { data: fullWorkout } = useWorkout(activeWorkout?.id);
  const { data: inProgress } = useInProgressSession();
  const {
    data: weekSessions,
    isError: weekFailed,
    error: weekError,
    refetch: refetchWeek,
  } = useWeekSessions();

  const startSession = useStartSession();

  // Data aberta ('YYYY-MM-DD'); null = a de hoje, '' = nenhuma.
  const [expanded, setExpanded] = useState<string | null>(null);

  // Fotos de registro (guardadas no celular) e a que está aberta em tela cheia.
  const { data: photosBySession } = useWorkoutPhotos();
  const [viewer, setViewer] = useState<{ photos: string[]; title: string } | null>(null);

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
  };

  const handleStartDay = async (day: WorkoutDay) => {
    if (!activeWorkout) return;

    if (day.exercises.length === 0) {
      toast.showError('Este dia ainda não tem exercícios. Monte a ficha antes de treinar.');
      navigation.navigate('CycleEditor', { workoutId: activeWorkout.id });
      return;
    }

    try {
      const sessionId = await startSession.mutateAsync({ workoutId: activeWorkout.id, dayId: day.id });
      navigation.navigate('Session', { sessionId });
    } catch (caught) {
      toast.showError(getErrorMessage(caught, 'Não foi possível iniciar o treino.'));
    }
  };

  const today = new Date();
  const dates = weekDates(today);
  const schedule = buildWeekSchedule(fullWorkout?.days ?? []);
  const firstDate = dates[0] as Date;
  const lastDate = dates[6] as Date;

  /** O treino do dia: o em andamento vence o finalizado. */
  const sessionOn = (date: Date): WeekSession | null => {
    const sameDay = (weekSessions ?? []).filter((item) => isSameDay(new Date(item.started_at), date));
    return sameDay.find((item) => item.status === 'in_progress') ?? sameDay[sameDay.length - 1] ?? null;
  };

  // Treino aberto antes desta semana: sem linha onde aparecer, ganha
  // um aviso próprio para não ficar esquecido.
  const orphanSession =
    inProgress && !dates.some((date) => isSameDay(new Date(inProgress.started_at), date)) ? inProgress : null;

  return (
    <Screen onRefresh={handleRefresh} refreshing={isRefetching}>
      <Greeting>
        <Hello>Olá, {profile ? firstName(profile.name) : 'atleta'} 👋</Hello>
        <Sub>{`Semana de ${shortDate(firstDate)} a ${shortDate(lastDate)}`}</Sub>
      </Greeting>

      {orphanSession && (
        <Banner>
          <BannerText>{`Você tem um treino em andamento desde ${shortDate(new Date(orphanSession.started_at))}.`}</BannerText>
          <Button fullWidth onPress={() => navigation.navigate('Session', { sessionId: orphanSession.id })}>
            Continuar treino
          </Button>
        </Banner>
      )}

      {/* Sem isto, uma falha aqui faria os dias treinados parecerem
          descanso, sem nenhum aviso. */}
      {weekFailed && (
        <Banner>
          <BannerText>
            {getErrorMessage(weekError, 'Não foi possível carregar os treinos desta semana.')}
          </BannerText>
          <Button variant="secondary" fullWidth onPress={() => void refetchWeek()}>
            Tentar novamente
          </Button>
        </Banner>
      )}

      {isPending && <Skeleton height={420} />}

      {isError && (
        <ErrorState
          message={getErrorMessage(error, 'Não foi possível carregar sua programação.')}
          action={
            <Button variant="secondary" onPress={() => void refetch()}>
              Tentar novamente
            </Button>
          }
        />
      )}

      {!isPending && !isError && !activeWorkout && (
        <EmptyState
          title="Nenhuma ficha ativa no momento"
          message="Crie uma ficha com os dias de treino para ver a programação da semana aqui."
          icon="calendar-outline"
          action={<Button onPress={() => navigation.navigate('CycleForm')}>Criar nova ficha</Button>}
        />
      )}

      {activeWorkout && fullWorkout && fullWorkout.days.length === 0 && (
        <EmptyState
          title="Ficha sem dias de treino"
          message="Monte os dias da ficha para ver a programação da semana."
          icon="calendar-outline"
          action={
            <Button onPress={() => navigation.navigate('CycleEditor', { workoutId: activeWorkout.id })}>
              Montar ficha
            </Button>
          }
        />
      )}

      {activeWorkout && fullWorkout && fullWorkout.days.length > 0 && (
        <Week>
          {dates.map((date, index) => {
            const dateOnly = toDateOnly(date);
            const inCycle = dateOnly >= activeWorkout.start_date && dateOnly <= activeWorkout.end_date;
            // Fora do período o treino continua visível para consulta,
            // só não conta como pendente nem pode ser iniciado.
            const planned = schedule[index] ?? null;
            const session = sessionOn(date);
            const trained = session ? fullWorkout.days.find((day) => day.id === session.workout_day_id) : undefined;
            const day = trained ?? planned;

            const isToday = isSameDay(date, today);
            const isPast = !isToday && date < today;

            // Dia com treino mostra o que foi FEITO (cópia gravada na
            // sessão); sem treino, o que a ficha programa.
            const items: ExerciseItem[] = session
              ? session.executions.map((execution) => ({
                  id: execution.id,
                  name: execution.exercise_name,
                  sets: execution.prescription?.sets ?? null,
                  repetitions: execution.prescription?.repetitions ?? null,
                  weight: execution.load,
                  rest: execution.prescription?.rest_seconds ?? null,
                }))
              : (day?.exercises ?? []).map((item) => ({
                  id: item.id,
                  name: item.exercise.name,
                  sets: item.sets,
                  repetitions: item.repetitions,
                  weight: item.weight,
                  rest: item.rest_seconds,
                }));
            const photos = session ? (photosBySession?.[session.id] ?? []) : [];
            const canExpand = Boolean(day || session);
            // Hoje começa aberto; os outros dias abrem ao toque.
            const isExpanded = canExpand && (expanded ?? toDateOnly(today)) === dateOnly;

            return (
              <DayCard key={dateOnly} $today={isToday} $rest={!canExpand}>
                <DayToggle
                  onPress={() => setExpanded(isExpanded ? '' : dateOnly)}
                  disabled={!canExpand}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isExpanded, disabled: !canExpand }}
                  accessibilityLabel={`${formatWeekdayDate(date)}: ${day ? day.focus || day.name : session?.dayName ?? 'descanso'}`}
                >
                  <DayTop>
                    <DateText $today={isToday}>{formatWeekdayDate(date)}</DateText>
                    {isToday && <TodayTag>HOJE</TodayTag>}
                    {canExpand && (
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={theme.colors.textMuted}
                      />
                    )}
                  </DayTop>

                  {day || session ? (
                    <DayBody>
                      <DayTexts>
                        <DayTitle>{day ? day.focus || day.name : session?.dayName}</DayTitle>
                        <DayMeta>
                          {day?.focus ? `${day.name} · ` : ''}
                          {pluralize(items.length, 'exercício', 'exercícios')}
                        </DayMeta>
                      </DayTexts>

                      {/* Foto de registro de treino concluído: a mais recente
                          na capa, e um contador se houver mais. */}
                      {session?.status === 'completed' && photos.length > 0 && (
                        <Pressable
                          onPress={() => setViewer({ photos, title: day ? day.focus || day.name : session.dayName })}
                          accessibilityRole="imagebutton"
                          accessibilityLabel={`Ver ${pluralize(photos.length, 'foto', 'fotos')} do treino`}
                          hitSlop={6}
                        >
                          <Thumb source={{ uri: photos[photos.length - 1] }} />
                          {photos.length > 1 && (
                            <ThumbCount>
                              <ThumbCountText>{`+${photos.length - 1}`}</ThumbCountText>
                            </ThumbCount>
                          )}
                        </Pressable>
                      )}
                    </DayBody>
                  ) : (
                    <RestText>Descanso</RestText>
                  )}
                </DayToggle>

                {isExpanded && (
                  <ExerciseList>
                    {items.length === 0 && <DayMeta>Nenhum exercício neste dia ainda.</DayMeta>}
                    {items.map((item, position) => (
                      <ExerciseRow key={item.id}>
                        <ExerciseName>{`${position + 1}. ${item.name}`}</ExerciseName>
                        <Wrap>
                          {item.sets !== null && <Tag>{`${item.sets}×${item.repetitions ?? ''}`}</Tag>}
                          <Tag $accent>{formatWeight(item.weight)}</Tag>
                          {item.rest !== null && <Tag>{`descanso ${formatRest(item.rest)}`}</Tag>}
                        </Wrap>
                      </ExerciseRow>
                    ))}
                  </ExerciseList>
                )}

                {session?.status === 'completed' && session.completed_at && (
                  <StatusRow>
                    <Ionicons name="checkmark-circle" size={18} color={theme.colors.accent} />
                    <DoneText>
                      {`Concluído · ${formatDuration(elapsedSeconds(session.started_at, session.completed_at))}`}
                    </DoneText>
                  </StatusRow>
                )}

                {session?.status === 'in_progress' && (
                  <>
                    <StatusRow>
                      <Pulse />
                      <LiveText>
                        Em andamento · <LiveTimer startedAt={session.started_at} />
                      </LiveText>
                    </StatusRow>
                    <Button fullWidth onPress={() => navigation.navigate('Session', { sessionId: session.id })}>
                      Continuar treino
                    </Button>
                  </>
                )}

                {!session && planned && !inCycle && (
                  <MissedText>
                    {dateOnly < activeWorkout.start_date
                      ? `Antes do início da ficha (${formatDateOnly(activeWorkout.start_date)})`
                      : `Depois do término da ficha (${formatDateOnly(activeWorkout.end_date)})`}
                  </MissedText>
                )}

                {!session && isToday && inCycle && planned && (
                  <Button
                    size="lg"
                    fullWidth
                    onPress={() => void handleStartDay(planned)}
                    loading={startSession.isPending}
                    disabled={Boolean(inProgress)}
                  >
                    {inProgress ? 'Finalize o treino em andamento' : 'Iniciar treino'}
                  </Button>
                )}

                {!session && isPast && inCycle && planned && <MissedText>Não realizado</MissedText>}
              </DayCard>
            );
          })}
        </Week>
      )}

      <PhotoViewer
        photos={viewer?.photos ?? []}
        startIndex={viewer ? viewer.photos.length - 1 : null}
        onClose={() => setViewer(null)}
        title={viewer?.title}
      />
    </Screen>
  );
}

/** Cronômetro isolado: só ele re-renderiza a cada segundo. */
function LiveTimer({ startedAt }: { startedAt: string }) {
  const now = useNow();
  return <>{formatClock(elapsedSeconds(startedAt, null, now))}</>;
}

/** Date → "26/10" */
function shortDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

const Greeting = styled.View`
  margin-bottom: ${space(5)};
`;

const Hello = styled.Text`
  color: ${color('text')};
  font-size: ${font('xxl')};
  font-weight: 800;
`;

const Sub = styled.Text`
  color: ${color('textMuted')};
  font-size: ${font('sm')};
  margin-top: ${space(1)};
`;

const Banner = styled.View`
  gap: ${space(3)};
  padding: ${space(4)};
  margin-bottom: ${space(4)};
  border-radius: ${radius('lg')};
  border-width: 1px;
  border-color: ${color('accentBorder')};
  background-color: ${color('accentSoft')};
`;

const BannerText = styled.Text`
  color: ${color('text')};
  font-size: ${font('sm')};
  font-weight: 600;
`;

const Week = styled.View`
  gap: ${space(3)};
`;

const DayCard = styled.View<{ $today: boolean; $rest: boolean }>`
  gap: ${space(2)};
  padding: ${space(4)};
  border-radius: ${radius('lg')};
  border-width: ${({ $today }) => ($today ? '2px' : '1px')};
  border-color: ${({ theme, $today }) => ($today ? theme.colors.accent : theme.colors.border)};
  background-color: ${({ theme, $today }) => ($today ? theme.colors.accentSoft : theme.colors.surface)};
  opacity: ${({ $rest }) => ($rest ? 0.7 : 1)};
`;

const DayToggle = styled.Pressable`
  gap: ${space(2)};
`;

const ExerciseList = styled.View`
  gap: ${space(2)};
  margin-top: ${space(1)};
`;

const ExerciseRow = styled.View`
  gap: ${space(2)};
  padding: ${space(3)};
  border-radius: ${radius('md')};
  background-color: ${color('bg')};
`;

const ExerciseName = styled.Text`
  color: ${color('text')};
  font-size: ${font('sm')};
  font-weight: 700;
`;

const DayTop = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: ${space(2)};
`;

const DateText = styled.Text<{ $today: boolean }>`
  flex: 1;
  color: ${({ theme, $today }) => ($today ? theme.colors.accent : theme.colors.textMuted)};
  font-size: ${font('sm')};
  font-weight: 700;
`;

const TodayTag = styled.Text`
  overflow: hidden;
  padding: 2px ${space(2)};
  border-radius: 6px;
  color: ${color('textOnAccent')};
  background-color: ${color('accent')};
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.6px;
`;

const DayTitle = styled.Text`
  color: ${color('text')};
  font-size: ${font('lg')};
  font-weight: 700;
`;

const DayMeta = styled.Text`
  color: ${color('textSubtle')};
  font-size: ${font('xs')};
  margin-top: -${space(1)};
`;

const RestText = styled.Text`
  color: ${color('textSubtle')};
  font-size: ${font('base')};
  font-weight: 600;
`;

const StatusRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: ${space(2)};
`;

const DoneText = styled.Text`
  color: ${color('accent')};
  font-size: ${font('sm')};
  font-weight: 700;
`;

const Pulse = styled.View`
  width: 8px;
  height: 8px;
  border-radius: 4px;
  background-color: ${color('accent')};
`;

const LiveText = styled.Text`
  color: ${color('accent')};
  font-size: ${font('sm')};
  font-weight: 700;
  font-variant: tabular-nums;
`;

const MissedText = styled.Text`
  color: ${color('textSubtle')};
  font-size: ${font('xs')};
  font-weight: 600;
`;

const DayBody = styled.View`
  flex-direction: row;
  align-items: center;
  gap: ${space(3)};
`;

const DayTexts = styled.View`
  flex: 1;
  gap: 2px;
`;

const Thumb = styled.Image`
  width: 56px;
  height: 56px;
  border-radius: ${radius('md')};
  border-width: 1px;
  border-color: ${color('accentBorder')};
  background-color: ${color('surfaceRaised')};
`;

const ThumbCount = styled.View`
  position: absolute;
  right: -6px;
  bottom: -6px;
  min-width: 24px;
  height: 22px;
  padding: 0 6px;
  border-radius: 11px;
  align-items: center;
  justify-content: center;
  background-color: ${color('accent')};
`;

const ThumbCountText = styled.Text`
  color: ${color('textOnAccent')};
  font-size: ${font('xs')};
  font-weight: 800;
`;
