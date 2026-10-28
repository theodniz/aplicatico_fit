import { Pressable } from 'react-native';
import styled from 'styled-components/native';
import { useWorkout } from '../hooks/useWorkouts';
import { useCycleStats, useExerciseProgress } from '../hooks/useProgress';
import { useSessionHistory } from '../hooks/useSessions';
import { CycleBadge, ProgressBar } from '../components/domain/Cycle';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState, Loading, Notice } from '../components/ui/Feedback';
import { Screen } from '../components/ui/Screen';
import { Card, Muted, Section, SectionTitle, Strong, Wrap } from '../components/ui/Typography';
import { computeProgress, computeStatus, formatPeriod } from '../utils/cycle';
import { elapsedSeconds, formatDate, formatDuration, formatWeight, pluralize } from '../utils/format';
import { muscleGroupLabel } from '../constants/muscleGroups';
import { getErrorMessage } from '../lib/errors';
import type { ExerciseProgress } from '../types/models';
import { useAppNavigation } from '../navigation/types';
import type { RootScreenProps } from '../navigation/types';
import { color, font, radius, space } from '../theme/theme';

/**
 * Acompanhamento do ciclo.
 *
 * Todo número aqui vem de sessões e execuções realmente gravadas.
 *
 * Onde não há dado, não há número: sem meta definida, não existe
 * percentual de frequência — mostramos o total absoluto de treinos
 * e um convite para definir a meta.
 */
export default function CycleSummaryScreen({ route }: RootScreenProps<'CycleSummary'>) {
  return <CycleAnalysis workoutId={route.params.workoutId} />;
}

/**
 * Conteúdo da análise, compartilhado com a aba Análise (que mostra o
 * ciclo ativo).
 */
export function CycleAnalysis({ workoutId }: { workoutId: string }) {
  const navigation = useAppNavigation();

  const { data: workout, isPending, isError, error } = useWorkout(workoutId);
  const { data: stats, refetch: refetchStats, isRefetching } = useCycleStats(workoutId);
  const { data: sessions, refetch: refetchSessions } = useSessionHistory(workoutId);
  const { data: progress, refetch: refetchProgress } = useExerciseProgress(workoutId);

  if (isPending) return <Loading message="Carregando acompanhamento…" fullScreen />;

  if (isError || !workout) {
    return (
      <Screen>
        <ErrorState message={getErrorMessage(error, 'Não foi possível carregar o ciclo.')} />
      </Screen>
    );
  }

  const status = computeStatus(workout);
  const cycleProgress = computeProgress(workout);
  const goal = workout.session_goal;
  const completed = stats?.completedSessions ?? 0;

  // Tempo de treino: só sessões finalizadas têm duração real.
  const durations = (sessions ?? [])
    .filter((item) => item.status === 'completed' && item.completed_at)
    .map((item) => elapsedSeconds(item.started_at, item.completed_at));
  const totalSeconds = durations.reduce((sum, value) => sum + value, 0);
  const averageSeconds = durations.length > 0 ? Math.round(totalSeconds / durations.length) : null;

  // Exercícios com evolução calculável, do maior ganho para o menor.
  const evolved = (progress ?? []).filter((item) => item.delta !== null && item.delta !== 0);

  const refresh = () => {
    void refetchStats();
    void refetchSessions();
    void refetchProgress();
  };

  return (
    <Screen subtitle={workout.name} onRefresh={refresh} refreshing={isRefetching}>
      <Wrap style={{ marginBottom: 24 }}>
        <CycleBadge status={status} />
        <Muted>{formatPeriod(workout)}</Muted>
      </Wrap>

      {/* ---- Progresso do período ---- */}
      <Section>
        <SectionTitle>Progresso do ciclo</SectionTitle>
        <Card>
          <ProgressBar
            percent={cycleProgress.percent}
            label="Dias decorridos"
            value={`${cycleProgress.elapsedDays} de ${cycleProgress.totalDays}`}
            large
          />
          <Muted>
            {status === 'active'
              ? pluralize(cycleProgress.remainingDays, 'dia restante', 'dias restantes')
              : status === 'upcoming'
                ? 'O ciclo ainda não começou.'
                : 'Período encerrado.'}
          </Muted>
        </Card>
      </Section>

      {/* ---- Treinos ---- */}
      <Section>
        <SectionTitle>Treinos</SectionTitle>

        <Stats>
          <Stat>
            <StatValue>{completed}</StatValue>
            <StatLabel>Concluídos</StatLabel>
          </Stat>
          <Stat>
            <StatValue $small>{averageSeconds === null ? '—' : formatDuration(averageSeconds)}</StatValue>
            <StatLabel>Duração média</StatLabel>
          </Stat>
          <Stat>
            <StatValue $small>{durations.length === 0 ? '—' : formatDuration(totalSeconds)}</StatValue>
            <StatLabel>Tempo total</StatLabel>
          </Stat>
        </Stats>

        {/* A meta é opcional; o percentual só existe se ela existir. */}
        {goal !== null ? (
          <Card>
            <ProgressBar percent={(completed / goal) * 100} label="Meta do ciclo" value={`${completed} de ${goal}`} />
          </Card>
        ) : (
          <Notice>
            <Muted>
              Você não definiu uma meta de treinos para este ciclo, então não há percentual de frequência a
              calcular.
            </Muted>
            <Button variant="ghost" size="sm" onPress={() => navigation.navigate('CycleEditor', { workoutId })}>
              Definir meta
            </Button>
          </Notice>
        )}

        {stats?.lastSessionAt && (
          <Muted style={{ marginTop: 12 }}>
            Último treino em <Strong>{formatDate(stats.lastSessionAt)}</Strong>
          </Muted>
        )}
      </Section>

      {/* ---- Evolução de carga ---- */}
      <Section>
        <SectionTitle>Evolução de carga</SectionTitle>
        {evolved.length === 0 ? (
          <Notice>
            A evolução aparece quando um exercício for realizado ao menos duas vezes com carga registrada. Assim a
            comparação tem base real.
          </Notice>
        ) : (
          <List>
            {evolved.map((item) => (
              <ProgressRow key={item.exerciseId} item={item} />
            ))}
          </List>
        )}
      </Section>

      {/* ---- Histórico de sessões ---- */}
      <Section>
        <SectionTitle>Histórico de treinos</SectionTitle>

        {!sessions || sessions.length === 0 ? (
          <EmptyState
            title="Nenhum treino registrado"
            message={
              status === 'active'
                ? 'Inicie um treino para começar a construir seu histórico.'
                : 'Nenhum treino foi registrado durante este ciclo.'
            }
            action={
              status === 'active' ? (
                <Button onPress={() => navigation.navigate('Workout', { workoutId })}>Ir para a ficha</Button>
              ) : undefined
            }
          />
        ) : (
          <List>
            {sessions.map((session) => (
              <Row
                key={session.id}
                as={Pressable}
                onPress={() => navigation.navigate('Session', { sessionId: session.id })}
                accessibilityRole="button"
                accessibilityLabel={`Ver treino ${session.dayName} de ${formatDate(session.started_at)}`}
              >
                <RowMain>
                  <RowTitle>{`${session.dayName} · ${formatDate(session.started_at)}`}</RowTitle>
                  <Muted>
                    {session.status === 'completed'
                      ? `Duração: ${formatDuration(elapsedSeconds(session.started_at, session.completed_at))}`
                      : pluralize(session.totalCount, 'exercício', 'exercícios')}
                  </Muted>
                </RowMain>
                <SessionTag $done={session.status === 'completed'}>
                  {session.status === 'completed' ? 'Concluído' : 'Em andamento'}
                </SessionTag>
              </Row>
            ))}
          </List>
        )}
      </Section>

      <Button variant="secondary" fullWidth onPress={() => navigation.navigate('Progress')}>
        Ver evolução de todos os ciclos
      </Button>
    </Screen>
  );
}

/** Linha de evolução, compartilhada com a tela de Evolução. */
export function ProgressRow({ item, detailed = false }: { item: ExerciseProgress; detailed?: boolean }) {
  return (
    <Row>
      <RowMain>
        <RowTitle>{item.exerciseName}</RowTitle>
        {detailed ? (
          <>
            <Muted>
              {`${muscleGroupLabel(item.muscleGroup)} · ${pluralize(item.sessionCount, 'execução', 'execuções')}`}
            </Muted>
            <Muted>
              {`Atual ${formatWeight(item.latestLoad)} · máx ${formatWeight(item.maxLoad)}`}
              {item.lastPerformedAt ? ` · ${formatDate(item.lastPerformedAt)}` : ''}
            </Muted>
          </>
        ) : (
          <Muted>
            {`${muscleGroupLabel(item.muscleGroup)} · ${formatWeight(item.firstLoad)} → ${formatWeight(item.latestLoad)}`}
          </Muted>
        )}
      </RowMain>

      {/* Sem delta significa uma execução só, ou nenhuma com carga.
          Mostrar "+0 kg" sugeriria estagnação onde não houve
          comparação. */}
      <Delta $up={(item.delta ?? 0) > 0}>
        {item.delta === null ? '—' : `${item.delta > 0 ? '+' : ''}${String(item.delta).replace('.', ',')} kg`}
      </Delta>
    </Row>
  );
}

const Stats = styled.View`
  flex-direction: row;
  gap: ${space(2)};
  margin-bottom: ${space(3)};
`;

const Stat = styled.View`
  flex: 1;
  align-items: center;
  padding: ${space(4)} ${space(2)};
  border-radius: ${radius('md')};
  border-width: 1px;
  border-color: ${color('border')};
  background-color: ${color('surface')};
`;

/** `$small` para durações ("1h 05min"), que não cabem no tamanho do número. */
const StatValue = styled.Text<{ $small?: boolean }>`
  color: ${color('text')};
  font-size: ${(props) => (props.$small ? font('lg') : font('xxl'))(props)};
  font-weight: 800;
  text-align: center;
`;

const StatLabel = styled.Text`
  color: ${color('textMuted')};
  font-size: ${font('xs')};
  margin-top: 2px;
`;

const List = styled.View`
  gap: ${space(2)};
`;

const Row = styled.View`
  flex-direction: row;
  align-items: center;
  gap: ${space(3)};
  padding: ${space(3)} ${space(4)};
  border-radius: ${radius('md')};
  border-width: 1px;
  border-color: ${color('border')};
  background-color: ${color('surface')};
`;

const RowMain = styled.View`
  flex: 1;
  gap: 2px;
`;

const RowTitle = styled.Text`
  color: ${color('text')};
  font-size: ${font('base')};
  font-weight: 600;
`;

const Delta = styled.Text<{ $up: boolean }>`
  overflow: hidden;
  padding: ${space(1)} ${space(2)};
  border-radius: ${radius('sm')};
  font-size: ${font('sm')};
  font-weight: 800;
  color: ${({ theme, $up }) => ($up ? theme.colors.accent : theme.colors.textMuted)};
  background-color: ${({ theme, $up }) => ($up ? theme.colors.accentSoft : theme.colors.surfaceRaised)};
`;

const SessionTag = styled.Text<{ $done: boolean }>`
  overflow: hidden;
  padding: ${space(1)} ${space(2)};
  border-radius: ${radius('sm')};
  font-size: ${font('xs')};
  font-weight: 700;
  color: ${({ theme, $done }) => ($done ? theme.colors.accent : theme.colors.warning)};
  background-color: ${({ theme, $done }) => ($done ? theme.colors.accentSoft : theme.colors.warningSoft)};
`;
