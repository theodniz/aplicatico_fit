import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { usePreventRemove } from '@react-navigation/native';
import type { NavigationAction } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import styled, { useTheme } from 'styled-components/native';
import { useCompleteSession, useSession } from '../hooks/useSessions';
import { useNow } from '../hooks/useNow';
import { useToast } from '../contexts/ToastContext';
import { VideoToggle } from '../components/domain/VideoPlayer';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { ErrorState, Loading } from '../components/ui/Feedback';
import { Tag, Wrap } from '../components/ui/Typography';
import { muscleGroupLabel } from '../constants/muscleGroups';
import { elapsedSeconds, formatClock, formatDuration, formatRest, formatWeight } from '../utils/format';
import { formatWeekdayDate } from '../utils/schedule';
import { getErrorMessage } from '../lib/errors';
import { canTakeWorkoutPhoto } from '../services/photos';
import { useTakeWorkoutPhoto, useWorkoutPhotos } from '../hooks/usePhotos';
import { PhotoViewer } from '../components/domain/PhotoViewer';
import type { ExerciseExecution } from '../types/models';
import type { RootScreenProps } from '../navigation/types';
import { color, font, radius, space } from '../theme/theme';

/** Para onde ir depois de autorizar a saída. */
type Leave = { kind: 'home' } | { kind: 'action'; action: NavigationAction };

/**
 * Execução do treino.
 *
 * - O cronômetro começa quando o treino é iniciado e é calculado a
 *   partir de `started_at`: sair do app ou bloquear a tela não o
 *   atrasa. Ao finalizar, a duração fica registrada na sessão.
 * - Os exercícios são só para consulta: séries, repetições e carga
 *   vêm da ficha. Nada a marcar ou ajustar no meio da série.
 * - Um treino finalizado abre aqui também, só para leitura: o que
 *   foi feito e quanto durou.
 * - Tela cheia, sem barra de abas. Voltar (botão, gesto ou tecla do
 *   Android) passa por uma confirmação, e o cronômetro continua
 *   correndo para retomar depois.
 */
export default function SessionScreen({ navigation, route }: RootScreenProps<'Session'>) {
  const { sessionId } = route.params;
  const theme = useTheme();
  const toast = useToast();

  const { data: session, isPending, isError, error } = useSession(sessionId);
  const completeSession = useCompleteSession();
  const now = useNow(1000, session?.status === 'in_progress');

  const [exitOpen, setExitOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [leave, setLeave] = useState<Leave | null>(null);
  const pendingAction = useRef<NavigationAction | null>(null);

  // Fotos de registro deste treino, guardadas no próprio celular.
  const { data: photosBySession } = useWorkoutPhotos();
  const photos = photosBySession?.[sessionId] ?? [];
  const takePhoto = useTakeWorkoutPhoto(sessionId);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  // Só segura a saída de um treino em andamento.
  usePreventRemove(leave === null && session?.status === 'in_progress', ({ data }) => {
    pendingAction.current = data.action;
    setExitOpen(true);
  });

  // A saída liberada só pode ser executada DEPOIS do render em que o
  // bloqueio foi desligado; por isso ela mora num efeito.
  useEffect(() => {
    if (!leave) return;
    if (leave.kind === 'action') navigation.dispatch(leave.action);
    else navigation.navigate('Tabs', { screen: 'Home' });
  }, [leave, navigation]);

  const goHome = () => navigation.navigate('Tabs', { screen: 'Home' });

  if (isPending) return <Loading message="Carregando treino…" fullScreen />;

  if (isError || !session) {
    return (
      <Safe>
        <Centered>
          <ErrorState
            message={getErrorMessage(error, 'Não foi possível carregar este treino.')}
            action={
              <Button variant="secondary" onPress={goHome}>
                Voltar ao início
              </Button>
            }
          />
        </Centered>
      </Safe>
    );
  }

  // Treino finalizado abre só para consulta: o que foi feito e quanto durou.
  const done = session.status === 'completed';
  const elapsed = elapsedSeconds(session.started_at, done ? session.completed_at : null, now);

  async function handleFinish() {
    try {
      await completeSession.mutateAsync(sessionId);
      setFinishOpen(false);
      toast.showSuccess(`Treino finalizado em ${formatDuration(elapsed)}! 🎉`);
      setLeave({ kind: 'home' });
    } catch (caught) {
      setFinishOpen(false);
      toast.showError(getErrorMessage(caught, 'Não foi possível finalizar o treino.'));
    }
  }

  async function handleTakePhoto() {
    try {
      const saved = await takePhoto.mutateAsync();
      if (!saved) return;
      if (saved.savedToGallery) toast.showSuccess('Foto salva no treino e na galeria do celular.');
      // Galeria negada: a foto não se perdeu, mas o usuário precisa saber
      // que ela não está junto das outras fotos dele.
      else toast.showInfo('Foto salva no treino. Libere a permissão de Fotos para salvá-la também na galeria.');
    } catch (caught) {
      toast.showError(getErrorMessage(caught, 'Não foi possível tirar a foto.'));
    }
  }

  function confirmExit() {
    setExitOpen(false);
    const action = pendingAction.current;
    pendingAction.current = null;
    setLeave(action ? { kind: 'action', action } : { kind: 'home' });
  }

  return (
    <Safe edges={['top', 'left', 'right']}>
      <Header>
        <HeaderTop>
          <ExitButton
            onPress={() => {
              if (!done) setExitOpen(true);
              else if (navigation.canGoBack()) navigation.goBack();
              else goHome();
            }}
            accessibilityRole="button"
            accessibilityLabel={done ? 'Voltar' : 'Sair do treino'}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </ExitButton>
          <HeaderTitles>
            <WorkoutName numberOfLines={1}>{session.day.focus || session.day.name}</WorkoutName>
            <HeaderSub numberOfLines={1}>{formatWeekdayDate(new Date(session.started_at))}</HeaderSub>
          </HeaderTitles>
          <Timer
            accessibilityRole={done ? 'text' : 'timer'}
            accessibilityLabel={`${done ? 'Duração do treino' : 'Tempo de treino'}: ${formatDuration(elapsed)}`}
          >
            <Ionicons
              name={done ? 'checkmark-circle' : 'stopwatch-outline'}
              size={16}
              color={theme.colors.accent}
            />
            <TimerValue>{done ? formatDuration(elapsed) : formatClock(elapsed)}</TimerValue>
          </Timer>
        </HeaderTop>
      </Header>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: theme.space[4], gap: theme.space[3] }}>
        {photos.length > 0 && (
          <PhotoStrip>
            <PhotoStripTitle>
              {photos.length === 1 ? '1 foto deste treino' : `${photos.length} fotos deste treino`}
            </PhotoStripTitle>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.space[2] }}>
              {photos.map((uri, index) => (
                <Pressable
                  key={uri}
                  onPress={() => setViewerIndex(index)}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={`Abrir foto ${index + 1} de ${photos.length}`}
                >
                  <PhotoThumb source={{ uri }} />
                </Pressable>
              ))}
            </ScrollView>
          </PhotoStrip>
        )}

        {session.executions.map((execution, index) => (
          <ExecutionCard key={execution.id} execution={execution} index={index + 1} />
        ))}
      </ScrollView>

      {!done && (
        <Footer>
          {canTakeWorkoutPhoto && (
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              onPress={() => void handleTakePhoto()}
              loading={takePhoto.isPending}
              icon={<Ionicons name="camera-outline" size={20} color={theme.colors.text} />}
            >
              Foto de registro
            </Button>
          )}
          <Button size="lg" fullWidth onPress={() => setFinishOpen(true)}>
            Finalizar treino
          </Button>
        </Footer>
      )}

      <PhotoViewer
        photos={photos}
        startIndex={viewerIndex}
        onClose={() => setViewerIndex(null)}
        title={session.day.focus || session.day.name}
      />

      <ConfirmDialog
        open={finishOpen}
        title="Finalizar treino"
        message={`O cronômetro para em ${formatDuration(elapsed)} e o treino fica registrado.`}
        confirmLabel="Finalizar"
        cancelLabel="Continuar treinando"
        destructive={false}
        loading={completeSession.isPending}
        onConfirm={() => void handleFinish()}
        onCancel={() => setFinishOpen(false)}
      />

      <ConfirmDialog
        open={exitOpen}
        title="Sair do treino"
        message="O treino continua em andamento e o cronômetro segue contando. Você pode voltar pela tela de início."
        confirmLabel="Sair"
        cancelLabel="Continuar treino"
        destructive={false}
        onConfirm={confirmExit}
        onCancel={() => {
          pendingAction.current = null;
          setExitOpen(false);
        }}
      />
    </Safe>
  );
}

// ---------------------------------------------------------------

function ExecutionCard({ execution, index }: { execution: ExerciseExecution; index: number }) {
  const theme = useTheme();
  const prescription = execution.prescription;

  return (
    <CardBox>
      <CardHead>
        <OrderCircle>
          <OrderText>{index}</OrderText>
        </OrderCircle>
        <Info>
          <ExerciseName>{execution.exercise.name}</ExerciseName>
          <Wrap>
            <Tag>{muscleGroupLabel(execution.exercise.muscle_group)}</Tag>
          </Wrap>
        </Info>
      </CardHead>

      {prescription && (
        <Metrics>
          <Metric>
            <MetricLabel>Séries</MetricLabel>
            <MetricValue>{prescription.sets}</MetricValue>
          </Metric>
          <Metric>
            <MetricLabel>Reps</MetricLabel>
            <MetricValue>{prescription.repetitions}</MetricValue>
          </Metric>
          <Metric $accent>
            <MetricLabel>Carga</MetricLabel>
            <MetricValue $accent>{formatWeight(execution.load)}</MetricValue>
          </Metric>
        </Metrics>
      )}

      {prescription?.rest_seconds !== null && prescription?.rest_seconds !== undefined && (
        <InfoRow>
          <Ionicons name="timer-outline" size={15} color={theme.colors.textMuted} />
          <InfoText>{`Descanso ${formatRest(prescription.rest_seconds)}`}</InfoText>
        </InfoRow>
      )}

      {prescription?.notes ? (
        <NotesBox>
          <Ionicons name="information-circle-outline" size={15} color={theme.colors.warning} />
          <NotesText>{prescription.notes}</NotesText>
        </NotesBox>
      ) : null}

      {execution.exercise.youtube_video_id ? (
        <VideoToggle videoId={execution.exercise.youtube_video_id} exerciseName={execution.exercise.name} />
      ) : null}
    </CardBox>
  );
}

const Safe = styled(SafeAreaView)`
  flex: 1;
  background-color: ${color('bg')};
`;

const Centered = styled.View`
  flex: 1;
  justify-content: center;
  padding: ${space(4)};
`;

const Header = styled.View`
  gap: ${space(3)};
  padding: ${space(3)} ${space(4)} ${space(4)};
  border-bottom-width: 1px;
  border-bottom-color: ${color('border')};
  background-color: ${color('surface')};
`;

const HeaderTop = styled.View`
  flex-direction: row;
  align-items: center;
  gap: ${space(3)};
`;

const ExitButton = styled.Pressable`
  width: 40px;
  height: 40px;
  border-radius: 20px;
  align-items: center;
  justify-content: center;
  background-color: ${color('surfaceRaised')};
`;

const HeaderTitles = styled.View`
  flex: 1;
`;

const WorkoutName = styled.Text`
  color: ${color('text')};
  font-size: ${font('lg')};
  font-weight: 800;
`;

const HeaderSub = styled.Text`
  color: ${color('textMuted')};
  font-size: ${font('xs')};
  margin-top: 2px;
`;

/** Pílula no canto do cabeçalho: visível sem roubar espaço dos exercícios. */
const Timer = styled.View`
  flex-direction: row;
  align-items: center;
  gap: ${space(1)};
  padding: ${space(1)} ${space(3)};
  border-radius: ${radius('full')};
  border-width: 1px;
  border-color: ${color('accentBorder')};
  background-color: ${color('accentSoft')};
`;

const TimerValue = styled.Text`
  color: ${color('text')};
  font-size: ${font('lg')};
  font-weight: 800;
  font-variant: tabular-nums;
`;

const Footer = styled.View`
  gap: ${space(3)};
  padding: ${space(3)} ${space(4)} ${space(5)};
  border-top-width: 1px;
  border-top-color: ${color('border')};
  background-color: ${color('surface')};
`;

const CardBox = styled.View`
  gap: ${space(3)};
  padding: ${space(4)};
  border-radius: ${radius('lg')};
  border-width: 1px;
  border-color: ${color('border')};
  background-color: ${color('surface')};
`;

const CardHead = styled.View`
  flex-direction: row;
  align-items: center;
  gap: ${space(3)};
`;

const OrderCircle = styled.View`
  width: 36px;
  height: 36px;
  border-radius: 18px;
  align-items: center;
  justify-content: center;
  background-color: ${color('surfaceRaised')};
`;

const OrderText = styled.Text`
  color: ${color('text')};
  font-size: ${font('sm')};
  font-weight: 800;
`;

const Info = styled.View`
  flex: 1;
  gap: ${space(1)};
`;

const ExerciseName = styled.Text`
  color: ${color('text')};
  font-size: ${font('lg')};
  font-weight: 700;
`;

const Metrics = styled.View`
  flex-direction: row;
  gap: ${space(2)};
`;

const Metric = styled.View<{ $accent?: boolean }>`
  flex: 1;
  align-items: center;
  gap: 2px;
  padding: ${space(2)};
  border-radius: ${radius('md')};
  background-color: ${({ theme, $accent }) => ($accent ? theme.colors.accentSoft : theme.colors.bg)};
`;

const MetricLabel = styled.Text`
  color: ${color('textSubtle')};
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
`;

const MetricValue = styled.Text<{ $accent?: boolean }>`
  color: ${({ theme, $accent }) => ($accent ? theme.colors.accent : theme.colors.text)};
  font-size: ${font('lg')};
  font-weight: 800;
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

const PhotoStrip = styled.View`
  gap: ${space(2)};
  padding: ${space(3)};
  border-radius: ${radius('lg')};
  border-width: 1px;
  border-color: ${color('accentBorder')};
  background-color: ${color('accentSoft')};
`;

const PhotoStripTitle = styled.Text`
  color: ${color('accent')};
  font-size: ${font('sm')};
  font-weight: 700;
`;

const PhotoThumb = styled.Image`
  width: 72px;
  height: 72px;
  border-radius: ${radius('md')};
  background-color: ${color('surfaceRaised')};
`;
