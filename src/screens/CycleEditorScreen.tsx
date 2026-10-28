import { useLayoutEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import styled, { useTheme } from 'styled-components/native';
import {
  useAddExerciseToDay,
  useCreateWorkoutDay,
  useDeleteWorkoutDay,
  useRemoveExerciseFromDay,
  useReorderDays,
  useReorderExercises,
  useUpdatePrescription,
  useUpdateWorkout,
  useUpdateWorkoutDay,
  useWorkout,
} from '../hooks/useWorkouts';
import { useToast } from '../contexts/ToastContext';
import { ExercisePicker } from '../components/domain/ExercisePicker';
import { Button, ButtonCell, ButtonRow, IconButton } from '../components/ui/Button';
import { Chip, ChipText, DateInput, FieldRow, Form, Input, TextArea } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState, ErrorState, InlineError, Loading } from '../components/ui/Feedback';
import { Screen } from '../components/ui/Screen';
import { Muted, Section, SectionTitle, Tag, Wrap } from '../components/ui/Typography';
import { muscleGroupLabel } from '../constants/muscleGroups';
import { validatePrescription, validateWorkout } from '../utils/validation';
import type { FieldErrors, PrescriptionFormValues, WorkoutFormValues } from '../utils/validation';
import { formatRest, formatWeight, pluralize } from '../utils/format';
import { WEEKDAY_NAMES, WEEKDAY_SHORT, describeWeekdays } from '../utils/schedule';
import { getErrorMessage } from '../lib/errors';
import type { WorkoutDay, WorkoutExercise } from '../types/models';
import type { RootScreenProps } from '../navigation/types';
import { color, font, radius, space } from '../theme/theme';

const EMPTY_PRESCRIPTION: PrescriptionFormValues = {
  exercise_id: '',
  sets: '3',
  repetitions: '10-12',
  weight: '',
  rest_seconds: '60',
  notes: '',
};

/**
 * Montagem da ficha: dados do ciclo + dias + exercícios de cada dia.
 *
 * Sobre a reordenação: botões ↑/↓ em vez de arrastar e soltar, tanto
 * para dias quanto para exercícios. Drag-and-drop em tela de toque
 * briga com o gesto de rolagem — o usuário tenta rolar a lista e
 * acaba arrastando um item. Os botões são previsíveis e acessíveis.
 */
export default function CycleEditorScreen({ navigation, route }: RootScreenProps<'CycleEditor'>) {
  const { workoutId } = route.params;
  const toast = useToast();

  const { data: workout, isPending, isError, error, refetch } = useWorkout(workoutId);

  const updateWorkout = useUpdateWorkout(workoutId);
  const createDay = useCreateWorkoutDay(workoutId);
  const updateDay = useUpdateWorkoutDay(workoutId);
  const deleteDay = useDeleteWorkoutDay(workoutId);
  const reorderDays = useReorderDays(workoutId);
  const addExercise = useAddExerciseToDay(workoutId);
  const updatePrescription = useUpdatePrescription(workoutId);
  const removeExercise = useRemoveExerciseFromDay(workoutId);

  // ----- Dados do ciclo -----
  const [details, setDetails] = useState<WorkoutFormValues | null>(null);
  const [detailErrors, setDetailErrors] = useState<FieldErrors<WorkoutFormValues>>({});

  // ----- Modal de dia -----
  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [editingDay, setEditingDay] = useState<WorkoutDay | null>(null);
  const [dayName, setDayName] = useState('');
  const [dayFocus, setDayFocus] = useState('');
  const [dayWeekdays, setDayWeekdays] = useState<number[]>([]);
  const [dayError, setDayError] = useState<string | null>(null);

  // ----- Modal de prescrição -----
  const [prescriptionOpen, setPrescriptionOpen] = useState(false);
  const [targetDay, setTargetDay] = useState<WorkoutDay | null>(null);
  const [editingPrescription, setEditingPrescription] = useState<WorkoutExercise | null>(null);
  const [prescription, setPrescription] = useState<PrescriptionFormValues>(EMPTY_PRESCRIPTION);
  const [prescriptionErrors, setPrescriptionErrors] = useState<FieldErrors<PrescriptionFormValues>>({});
  const [prescriptionError, setPrescriptionError] = useState<string | null>(null);

  const [removeTarget, setRemoveTarget] = useState<WorkoutExercise | null>(null);
  const [deleteDayTarget, setDeleteDayTarget] = useState<WorkoutDay | null>(null);

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

  // Inicializa o formulário a partir do dado carregado, sem
  // useEffect: derivar evita um render extra e o risco de
  // sobrescrever o que o usuário já digitou.
  const detailValues: WorkoutFormValues = details ?? {
    name: workout.name,
    description: workout.description ?? '',
    start_date: workout.start_date,
    end_date: workout.end_date,
    session_goal: workout.session_goal === null ? '' : String(workout.session_goal),
  };

  const detailsChanged =
    detailValues.name !== workout.name ||
    detailValues.description !== (workout.description ?? '') ||
    detailValues.start_date !== workout.start_date ||
    detailValues.end_date !== workout.end_date ||
    detailValues.session_goal !== (workout.session_goal === null ? '' : String(workout.session_goal));

  const updateDetail = (field: keyof WorkoutFormValues) => (text: string) => {
    setDetails({ ...detailValues, [field]: text });
    setDetailErrors((current) => ({ ...current, [field]: undefined }));
  };

  async function handleSaveDetails() {
    const errors = validateWorkout(detailValues);
    setDetailErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      await updateWorkout.mutateAsync({
        name: detailValues.name,
        description: detailValues.description || null,
        start_date: detailValues.start_date,
        end_date: detailValues.end_date,
        session_goal: detailValues.session_goal.trim() ? Number(detailValues.session_goal) : null,
      });
      setDetails(null); // volta a espelhar o dado do servidor
      toast.showSuccess('Ficha atualizada.');
    } catch (caught) {
      toast.showError(getErrorMessage(caught, 'Não foi possível salvar a ficha.'));
    }
  }

  // ----- Dias -----

  /** Dia da semana → nome do dia da ficha que já o ocupa. */
  const weekdayOwners = new Map<number, string>();
  for (const day of workout.days) {
    if (day.id === editingDay?.id) continue;
    for (const weekday of day.weekdays) weekdayOwners.set(weekday, day.name);
  }

  function openCreateDay() {
    const taken = new Set(workout?.days.flatMap((day) => day.weekdays) ?? []);
    const firstFree = [0, 1, 2, 3, 4, 5, 6].find((weekday) => !taken.has(weekday));
    setEditingDay(null);
    setDayName(`Dia ${(workout?.days.length ?? 0) + 1}`);
    setDayFocus('');
    setDayWeekdays(firstFree === undefined ? [] : [firstFree]);
    setDayError(null);
    setDayModalOpen(true);
  }

  function openEditDay(day: WorkoutDay) {
    setEditingDay(day);
    setDayName(day.name);
    setDayFocus(day.focus ?? '');
    setDayWeekdays(day.weekdays);
    setDayError(null);
    setDayModalOpen(true);
  }

  function toggleWeekday(weekday: number) {
    setDayWeekdays((current) =>
      current.includes(weekday) ? current.filter((item) => item !== weekday) : [...current, weekday],
    );
    setDayError(null);
  }

  async function handleSaveDay() {
    if (!dayName.trim()) {
      setDayError('Informe o nome do dia.');
      return;
    }

    const input = { name: dayName, focus: dayFocus || null, weekdays: dayWeekdays };
    try {
      if (editingDay) {
        await updateDay.mutateAsync({ dayId: editingDay.id, input });
        toast.showSuccess('Dia atualizado.');
      } else {
        await createDay.mutateAsync(input);
        toast.showSuccess('Dia adicionado.');
      }
      setDayModalOpen(false);
    } catch (caught) {
      setDayError(getErrorMessage(caught, 'Não foi possível salvar o dia.'));
    }
  }

  async function handleDeleteDay() {
    if (!deleteDayTarget) return;
    try {
      await deleteDay.mutateAsync(deleteDayTarget.id);
      toast.showSuccess('Dia excluído.');
    } catch (caught) {
      toast.showError(getErrorMessage(caught, 'Não foi possível excluir o dia.'));
    } finally {
      setDeleteDayTarget(null);
    }
  }

  const moveDay = (index: number, direction: -1 | 1) => {
    const items = [...workout.days];
    const target = index + direction;
    const current = items[index];
    const swap = items[target];
    if (!current || !swap) return;

    items[index] = swap;
    items[target] = current;
    reorderDays.mutate(items.map((item) => item.id));
  };

  // ----- Prescrições -----

  function openAddExercise(day: WorkoutDay) {
    setTargetDay(day);
    setEditingPrescription(null);
    setPrescription(EMPTY_PRESCRIPTION);
    setPrescriptionErrors({});
    setPrescriptionError(null);
    setPrescriptionOpen(true);
  }

  function openEditPrescription(day: WorkoutDay, item: WorkoutExercise) {
    setTargetDay(day);
    setEditingPrescription(item);
    setPrescription({
      exercise_id: item.exercise_id,
      sets: String(item.sets),
      repetitions: item.repetitions,
      weight: item.weight === null ? '' : String(item.weight),
      rest_seconds: item.rest_seconds === null ? '' : String(item.rest_seconds),
      notes: item.notes ?? '',
    });
    setPrescriptionErrors({});
    setPrescriptionError(null);
    setPrescriptionOpen(true);
  }

  const updatePrescriptionField = (field: keyof PrescriptionFormValues) => (text: string) => {
    setPrescription((current) => ({ ...current, [field]: text }));
    setPrescriptionErrors((current) => ({ ...current, [field]: undefined }));
    setPrescriptionError(null);
  };

  async function handleSavePrescription() {
    if (!targetDay) return;

    const errors = validatePrescription(prescription);
    setPrescriptionErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const payload = {
      sets: Number(prescription.sets),
      repetitions: prescription.repetitions.trim(),
      // Campo vazio vira null — "carga a definir", não zero.
      weight: prescription.weight.trim() ? Number(prescription.weight.replace(',', '.')) : null,
      rest_seconds: prescription.rest_seconds.trim() ? Number(prescription.rest_seconds) : null,
      notes: prescription.notes || null,
    };

    setPrescriptionError(null);
    try {
      if (editingPrescription) {
        await updatePrescription.mutateAsync({ prescriptionId: editingPrescription.id, input: payload });
        toast.showSuccess('Exercício atualizado.');
      } else {
        await addExercise.mutateAsync({
          dayId: targetDay.id,
          input: { ...payload, exercise_id: prescription.exercise_id },
        });
        toast.showSuccess('Exercício adicionado.');
      }
      setPrescriptionOpen(false);
    } catch (caught) {
      setPrescriptionError(getErrorMessage(caught, 'Não foi possível salvar o exercício.'));
    }
  }

  async function handleRemoveExercise() {
    if (!removeTarget) return;
    try {
      await removeExercise.mutateAsync(removeTarget.id);
      toast.showSuccess('Exercício removido do dia.');
    } catch (caught) {
      toast.showError(getErrorMessage(caught, 'Não foi possível remover o exercício.'));
    } finally {
      setRemoveTarget(null);
    }
  }

  const savingDay = createDay.isPending || updateDay.isPending;
  const savingPrescription = addExercise.isPending || updatePrescription.isPending;

  return (
    <Screen subtitle="Montagem da ficha">
      <Section>
        <SectionTitle>Dados da ficha</SectionTitle>
        <Form>
          <Input
            label="Nome"
            value={detailValues.name}
            onChangeText={updateDetail('name')}
            error={detailErrors.name}
            disabled={updateWorkout.isPending}
            maxLength={100}
            required
          />
          <TextArea
            label="Descrição"
            value={detailValues.description}
            onChangeText={updateDetail('description')}
            error={detailErrors.description}
            placeholder="Divisão de 4 dias com foco em hipertrofia."
            disabled={updateWorkout.isPending}
            maxLength={500}
          />
          <FieldRow>
            <DateInput
              label="Início"
              value={detailValues.start_date}
              onChange={updateDetail('start_date')}
              error={detailErrors.start_date}
              disabled={updateWorkout.isPending}
              required
            />
            <DateInput
              label="Término"
              value={detailValues.end_date}
              onChange={updateDetail('end_date')}
              error={detailErrors.end_date}
              disabled={updateWorkout.isPending}
              required
            />
          </FieldRow>
          <Input
            label="Meta de treinos no ciclo"
            value={detailValues.session_goal}
            onChangeText={updateDetail('session_goal')}
            error={detailErrors.session_goal}
            placeholder="24"
            hint="Opcional. Sem meta, o acompanhamento mostra apenas o total realizado."
            keyboardType="number-pad"
            disabled={updateWorkout.isPending}
          />
          <Button
            onPress={() => void handleSaveDetails()}
            loading={updateWorkout.isPending}
            disabled={!detailsChanged}
            fullWidth
          >
            {updateWorkout.isPending ? 'Salvando…' : 'Salvar dados'}
          </Button>
        </Form>
      </Section>

      <SectionHeader>
        <SectionTitle style={{ marginBottom: 0 }}>
          {`Divisão (${pluralize(workout.days.length, 'dia', 'dias')})`}
        </SectionTitle>
        <Button size="sm" onPress={openCreateDay}>
          Novo dia
        </Button>
      </SectionHeader>

      {workout.days.length === 0 ? (
        <EmptyState
          title="Ficha sem divisão"
          message="Adicione os dias de treino — por exemplo, Dia 1 para peito e ombro, Dia 2 para costas. Ou gere a divisão automaticamente."
          action={
            <>
              <Button onPress={() => navigation.navigate('CycleGenerator', { workoutId })}>
                Gerar divisão automaticamente
              </Button>
              <Button variant="secondary" onPress={openCreateDay}>
                Adicionar dia manualmente
              </Button>
            </>
          }
        />
      ) : (
        <DayList>
          {workout.days.map((day, index) => (
            <DayCard key={day.id}>
              <DayHeader>
                <ReorderButtons
                  name={day.name}
                  canUp={index > 0}
                  canDown={index < workout.days.length - 1}
                  busy={reorderDays.isPending}
                  onMove={(direction) => moveDay(index, direction)}
                />
                <DayTitles>
                  <DayName>{day.name}</DayName>
                  {day.focus ? <Muted>{day.focus}</Muted> : null}
                  <DayCount>
                    {`${day.weekdays.length > 0 ? describeWeekdays(day.weekdays) : 'Sem dia da semana'} · ${pluralize(day.exercises.length, 'exercício', 'exercícios')}`}
                  </DayCount>
                </DayTitles>
                <RowActions>
                  <IconButton onPress={() => openEditDay(day)} accessibilityLabel={`Editar ${day.name}`}>
                    <ThemedIcon name="create-outline" />
                  </IconButton>
                  <IconButton $danger onPress={() => setDeleteDayTarget(day)} accessibilityLabel={`Excluir ${day.name}`}>
                    <ThemedIcon name="trash-outline" danger />
                  </IconButton>
                </RowActions>
              </DayHeader>

              <DayExercises
                workoutId={workoutId}
                day={day}
                onEdit={(item) => openEditPrescription(day, item)}
                onRemove={setRemoveTarget}
              />

              <Button variant="secondary" size="sm" fullWidth onPress={() => openAddExercise(day)}>
                Adicionar exercício
              </Button>
            </DayCard>
          ))}
        </DayList>
      )}

      {/* ---- Modal: dia ---- */}
      <Modal
        open={dayModalOpen}
        onClose={() => setDayModalOpen(false)}
        title={editingDay ? 'Editar dia' : 'Novo dia'}
        busy={savingDay}
      >
        <Form>
          {dayError && <InlineError message={dayError} />}
          <Input
            label="Nome do dia"
            value={dayName}
            onChangeText={setDayName}
            placeholder="Dia 1"
            disabled={savingDay}
            maxLength={60}
            required
          />
          <Input
            label="Foco muscular"
            value={dayFocus}
            onChangeText={setDayFocus}
            placeholder="Peito, Ombro e Tríceps"
            hint="Opcional. Aparece como título do treino na programação da semana."
            disabled={savingDay}
            maxLength={120}
          />
          <WeekdayField>
            <WeekdayLabel>Dias da semana</WeekdayLabel>
            <WeekdayChips>
              {WEEKDAY_SHORT.map((label, weekday) => {
                const selected = dayWeekdays.includes(weekday);
                const owner = weekdayOwners.get(weekday);
                return (
                  <Chip
                    key={label}
                    $selected={selected}
                    $disabled={Boolean(owner) || savingDay}
                    disabled={Boolean(owner) || savingDay}
                    onPress={() => toggleWeekday(weekday)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected, disabled: Boolean(owner) }}
                    accessibilityLabel={owner ? `${WEEKDAY_NAMES[weekday]}, ocupada por ${owner}` : WEEKDAY_NAMES[weekday]}
                  >
                    <ChipText $selected={selected}>{label}</ChipText>
                  </Chip>
                );
              })}
            </WeekdayChips>
            <WeekdayHint>Dias apagados já estão com outro treino da ficha.</WeekdayHint>
          </WeekdayField>
          <ButtonRow>
            <ButtonCell>
              <Button variant="secondary" onPress={() => setDayModalOpen(false)} disabled={savingDay} fullWidth>
                Cancelar
              </Button>
            </ButtonCell>
            <ButtonCell>
              <Button onPress={() => void handleSaveDay()} loading={savingDay} fullWidth>
                {savingDay ? 'Salvando…' : 'Salvar'}
              </Button>
            </ButtonCell>
          </ButtonRow>
        </Form>
      </Modal>

      {/* ---- Modal: prescrição ---- */}
      <Modal
        open={prescriptionOpen}
        onClose={() => setPrescriptionOpen(false)}
        title={editingPrescription ? 'Editar exercício' : `Adicionar em ${targetDay?.name ?? 'dia'}`}
        busy={savingPrescription}
      >
        <Form>
          {prescriptionError && <InlineError message={prescriptionError} />}

          {editingPrescription ? (
            <Input label="Exercício" value={editingPrescription.exercise.name} disabled />
          ) : (
            <>
              <ExercisePicker
                value={prescription.exercise_id || null}
                onChange={(id) => {
                  setPrescription((current) => ({ ...current, exercise_id: id }));
                  setPrescriptionErrors((current) => ({ ...current, exercise_id: undefined }));
                }}
                usedExerciseIds={targetDay?.exercises.map((item) => item.exercise_id) ?? []}
              />
              {prescriptionErrors.exercise_id && <InlineError message={prescriptionErrors.exercise_id} />}
            </>
          )}

          <FieldRow>
            <Input
              label="Séries"
              value={prescription.sets}
              onChangeText={updatePrescriptionField('sets')}
              error={prescriptionErrors.sets}
              keyboardType="number-pad"
              disabled={savingPrescription}
              required
            />
            <Input
              label="Repetições"
              value={prescription.repetitions}
              onChangeText={updatePrescriptionField('repetitions')}
              error={prescriptionErrors.repetitions}
              placeholder="8-12"
              keyboardType="numbers-and-punctuation"
              disabled={savingPrescription}
              required
            />
          </FieldRow>

          <FieldRow>
            <Input
              label="Carga (kg)"
              value={prescription.weight}
              onChangeText={updatePrescriptionField('weight')}
              error={prescriptionErrors.weight}
              placeholder="30"
              hint="Usada no treino como está"
              keyboardType="decimal-pad"
              disabled={savingPrescription}
            />
            <Input
              label="Descanso (s)"
              value={prescription.rest_seconds}
              onChangeText={updatePrescriptionField('rest_seconds')}
              error={prescriptionErrors.rest_seconds}
              placeholder="90"
              keyboardType="number-pad"
              disabled={savingPrescription}
            />
          </FieldRow>

          <TextArea
            label="Observações"
            value={prescription.notes}
            onChangeText={updatePrescriptionField('notes')}
            error={prescriptionErrors.notes}
            placeholder="Controlar bem a descida."
            hint="Opcional. Aparece em destaque durante o treino."
            disabled={savingPrescription}
            maxLength={500}
          />

          <ButtonRow>
            <ButtonCell>
              <Button
                variant="secondary"
                onPress={() => setPrescriptionOpen(false)}
                disabled={savingPrescription}
                fullWidth
              >
                Cancelar
              </Button>
            </ButtonCell>
            <ButtonCell>
              <Button onPress={() => void handleSavePrescription()} loading={savingPrescription} fullWidth>
                {savingPrescription ? 'Salvando…' : 'Salvar'}
              </Button>
            </ButtonCell>
          </ButtonRow>
        </Form>
      </Modal>

      <ConfirmDialog
        open={removeTarget !== null}
        title="Remover do dia"
        message={
          removeTarget
            ? `Remover "${removeTarget.exercise.name}" deste dia? O exercício continua no seu catálogo.`
            : ''
        }
        confirmLabel="Remover"
        loading={removeExercise.isPending}
        onConfirm={() => void handleRemoveExercise()}
        onCancel={() => setRemoveTarget(null)}
      />

      <ConfirmDialog
        open={deleteDayTarget !== null}
        title="Excluir dia"
        message={
          deleteDayTarget
            ? `Excluir "${deleteDayTarget.name}"? Os exercícios do dia e TODOS os treinos já registrados nele serão removidos. Esta ação não pode ser desfeita.`
            : ''
        }
        loading={deleteDay.isPending}
        onConfirm={() => void handleDeleteDay()}
        onCancel={() => setDeleteDayTarget(null)}
      />
    </Screen>
  );
}

// ---------------------------------------------------------------

function ThemedIcon({ name, danger }: { name: 'create-outline' | 'trash-outline' | 'remove'; danger?: boolean }) {
  const theme = useTheme();
  return <Ionicons name={name} size={17} color={danger ? theme.colors.danger : theme.colors.textMuted} />;
}

function ReorderButtons({
  name,
  canUp,
  canDown,
  busy,
  onMove,
}: {
  name: string;
  canUp: boolean;
  canDown: boolean;
  busy: boolean;
  onMove: (direction: -1 | 1) => void;
}) {
  const theme = useTheme();
  return (
    <Reorder>
      <ReorderButton
        onPress={() => onMove(-1)}
        disabled={!canUp || busy}
        $disabled={!canUp || busy}
        accessibilityLabel={`Mover ${name} para cima`}
      >
        <Ionicons name="chevron-up" size={16} color={theme.colors.textMuted} />
      </ReorderButton>
      <ReorderButton
        onPress={() => onMove(1)}
        disabled={!canDown || busy}
        $disabled={!canDown || busy}
        accessibilityLabel={`Mover ${name} para baixo`}
      >
        <Ionicons name="chevron-down" size={16} color={theme.colors.textMuted} />
      </ReorderButton>
    </Reorder>
  );
}

interface DayExercisesProps {
  workoutId: string;
  day: WorkoutDay;
  onEdit: (item: WorkoutExercise) => void;
  onRemove: (item: WorkoutExercise) => void;
}

/**
 * Lista de exercícios de um dia.
 *
 * Componente separado porque cada dia precisa da própria instância
 * de `useReorderExercises` — o hook é parametrizado pelo dia, e
 * hooks não podem ser chamados dentro de um `map`.
 */
function DayExercises({ workoutId, day, onEdit, onRemove }: DayExercisesProps) {
  const reorder = useReorderExercises(workoutId, day.id);

  if (day.exercises.length === 0) {
    return <Muted>Nenhum exercício neste dia ainda.</Muted>;
  }

  const move = (index: number, direction: -1 | 1) => {
    const items = [...day.exercises];
    const target = index + direction;
    const current = items[index];
    const swap = items[target];
    if (!current || !swap) return;

    items[index] = swap;
    items[target] = current;
    reorder.mutate(items.map((item) => item.id));
  };

  return (
    <PrescriptionList>
      {day.exercises.map((item, index) => (
        <PrescriptionRow key={item.id}>
          <ReorderButtons
            name={item.exercise.name}
            canUp={index > 0}
            canDown={index < day.exercises.length - 1}
            busy={reorder.isPending}
            onMove={(direction) => move(index, direction)}
          />
          <PrescriptionBody>
            <PrescriptionName>
              {index + 1}. {item.exercise.name}
            </PrescriptionName>
            <Wrap>
              <Tag>{muscleGroupLabel(item.exercise.muscle_group)}</Tag>
              <Tag>{`${item.sets}×${item.repetitions}`}</Tag>
              <Tag>{formatWeight(item.weight)}</Tag>
              {item.rest_seconds !== null && <Tag>{formatRest(item.rest_seconds)}</Tag>}
            </Wrap>
          </PrescriptionBody>
          <RowActions>
            <IconButton onPress={() => onEdit(item)} accessibilityLabel={`Editar prescrição de ${item.exercise.name}`}>
              <ThemedIcon name="create-outline" />
            </IconButton>
            <IconButton
              $danger
              onPress={() => onRemove(item)}
              accessibilityLabel={`Remover ${item.exercise.name} do dia`}
            >
              <ThemedIcon name="remove" danger />
            </IconButton>
          </RowActions>
        </PrescriptionRow>
      ))}
    </PrescriptionList>
  );
}

const WeekdayField = styled.View`
  gap: ${space(2)};
`;

const WeekdayLabel = styled.Text`
  color: ${color('text')};
  font-size: ${font('sm')};
  font-weight: 600;
`;

const WeekdayChips = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  gap: ${space(2)};
`;

const WeekdayHint = styled.Text`
  color: ${color('textSubtle')};
  font-size: ${font('xs')};
  line-height: 16px;
`;

const SectionHeader = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${space(3)};
`;

const DayList = styled.View`
  gap: ${space(4)};
`;

const DayCard = styled.View`
  gap: ${space(3)};
  padding: ${space(4)};
  border-radius: ${radius('lg')};
  border-width: 1px;
  border-color: ${color('border')};
  background-color: ${color('surface')};
`;

const DayHeader = styled.View`
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

const DayCount = styled.Text`
  color: ${color('textSubtle')};
  font-size: ${font('xs')};
`;

const RowActions = styled.View`
  flex-direction: row;
  gap: ${space(2)};
`;

const Reorder = styled.View`
  gap: ${space(1)};
`;

const ReorderButton = styled.Pressable<{ $disabled: boolean }>`
  width: 28px;
  height: 22px;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background-color: ${color('surfaceRaised')};
  opacity: ${({ $disabled }) => ($disabled ? 0.35 : 1)};
`;

const PrescriptionList = styled.View`
  gap: ${space(2)};
`;

const PrescriptionRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: ${space(3)};
  padding: ${space(3)};
  border-radius: ${radius('md')};
  background-color: ${color('bg')};
`;

const PrescriptionBody = styled.View`
  flex: 1;
  gap: ${space(2)};
`;

const PrescriptionName = styled.Text`
  color: ${color('text')};
  font-size: ${font('sm')};
  font-weight: 700;
`;
