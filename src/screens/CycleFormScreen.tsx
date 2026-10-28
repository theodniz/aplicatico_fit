import { useState } from 'react';
import { useCreateWorkout, useDuplicateWorkout, useWorkout } from '../hooks/useWorkouts';
import { useToast } from '../contexts/ToastContext';
import { Button, ButtonCell, ButtonRow } from '../components/ui/Button';
import { DateInput, FieldRow, Form, Input, TextArea } from '../components/ui/Field';
import { InlineError } from '../components/ui/Feedback';
import { Screen } from '../components/ui/Screen';
import { validateWorkout } from '../utils/validation';
import type { FieldErrors, WorkoutFormValues } from '../utils/validation';
import { addDaysToInputValue, todayAsInputValue } from '../utils/cycle';
import { getErrorMessage } from '../lib/errors';
import type { RootScreenProps } from '../navigation/types';

/** Duração inicial sugerida. O usuário ajusta livremente. */
const DEFAULT_CYCLE_DAYS = 59;

/**
 * Criação de ciclo — do zero ou duplicando um existente.
 *
 * O parâmetro `duplicateFrom` ativa o modo duplicação: os exercícios
 * e as prescrições da ficha de origem são copiados, mas as sessões e
 * o histórico NÃO. O ciclo novo começa zerado, senão os indicadores
 * de acompanhamento nasceriam mentindo.
 */
export default function CycleFormScreen({ navigation, route }: RootScreenProps<'CycleForm'>) {
  const toast = useToast();

  const sourceId = route.params?.duplicateFrom;
  const isDuplicating = Boolean(sourceId);
  const { data: source } = useWorkout(sourceId);

  const createWorkout = useCreateWorkout();
  const duplicateWorkout = useDuplicateWorkout();

  const today = todayAsInputValue();
  const [values, setValues] = useState<WorkoutFormValues>({
    name: '',
    description: '',
    start_date: today,
    end_date: addDaysToInputValue(today, DEFAULT_CYCLE_DAYS),
    session_goal: '',
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<WorkoutFormValues>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Ao duplicar, sugerimos "<nome> (novo ciclo)" só uma vez, sem
  // sobrescrever o que o usuário já digitou.
  const [namePrefilled, setNamePrefilled] = useState(false);
  if (isDuplicating && source && !namePrefilled) {
    setNamePrefilled(true);
    setValues((current) => ({
      ...current,
      name: current.name || `${source.name} (novo ciclo)`,
      description: current.description || (source.description ?? ''),
    }));
  }

  const update = (field: keyof WorkoutFormValues) => (text: string) => {
    setValues((current) => ({ ...current, [field]: text }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  };

  const saving = createWorkout.isPending || duplicateWorkout.isPending;

  async function handleSubmit() {
    const errors = validateWorkout(values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setFormError(null);
    try {
      if (isDuplicating && sourceId) {
        const newId = await duplicateWorkout.mutateAsync({
          sourceId,
          name: values.name,
          start_date: values.start_date,
          end_date: values.end_date,
        });
        toast.showSuccess('Ficha duplicada. Confira os exercícios e as cargas.');
        navigation.replace('Workout', { workoutId: newId });
        return;
      }

      const workout = await createWorkout.mutateAsync({
        name: values.name,
        description: values.description || null,
        start_date: values.start_date,
        end_date: values.end_date,
        session_goal: values.session_goal.trim() ? Number(values.session_goal) : null,
      });
      toast.showSuccess('Ficha criada. Agora adicione os exercícios.');
      navigation.replace('CycleEditor', { workoutId: workout.id });
    } catch (caught) {
      setFormError(getErrorMessage(caught, 'Não foi possível criar a ficha.'));
    }
  }

  return (
    <Screen
      subtitle={
        isDuplicating
          ? 'Os exercícios são copiados; o histórico começa do zero'
          : 'Defina o período do seu ciclo de treino'
      }
    >
      <Form>
        {formError && <InlineError message={formError} />}

        <Input
          label="Nome da ficha"
          value={values.name}
          onChangeText={update('name')}
          error={fieldErrors.name}
          placeholder="Hipertrofia — Ciclo 1"
          disabled={saving}
          maxLength={100}
          required
        />

        {!isDuplicating && (
          <TextArea
            label="Descrição"
            value={values.description}
            onChangeText={update('description')}
            error={fieldErrors.description}
            placeholder="Treino focado em hipertrofia."
            hint="Opcional."
            disabled={saving}
            maxLength={500}
          />
        )}

        <FieldRow>
          <DateInput
            label="Início"
            value={values.start_date}
            onChange={update('start_date')}
            error={fieldErrors.start_date}
            disabled={saving}
            required
          />
          <DateInput
            label="Término"
            value={values.end_date}
            onChange={update('end_date')}
            error={fieldErrors.end_date}
            disabled={saving}
            required
          />
        </FieldRow>

        {!isDuplicating && (
          <Input
            label="Meta de treinos no ciclo"
            value={values.session_goal}
            onChangeText={update('session_goal')}
            error={fieldErrors.session_goal}
            placeholder="24"
            hint="Opcional. Sem meta, o acompanhamento mostra apenas o total de treinos realizados."
            keyboardType="number-pad"
            disabled={saving}
          />
        )}

        <ButtonRow>
          <ButtonCell>
            <Button variant="secondary" onPress={() => navigation.goBack()} disabled={saving} fullWidth>
              Cancelar
            </Button>
          </ButtonCell>
          <ButtonCell>
            <Button onPress={() => void handleSubmit()} loading={saving} fullWidth>
              {saving ? 'Salvando…' : isDuplicating ? 'Duplicar' : 'Criar ficha'}
            </Button>
          </ButtonCell>
        </ButtonRow>
      </Form>
    </Screen>
  );
}
