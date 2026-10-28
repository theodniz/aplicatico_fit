import { useMemo, useState } from 'react';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import styled, { useTheme } from 'styled-components/native';
import { useWorkout } from '../hooks/useWorkouts';
import {
  useExerciseCountsByGroup,
  useGenerateWorkoutPlan,
  useImportStarterExercises,
} from '../hooks/useGenerator';
import { useToast } from '../contexts/ToastContext';
import { Button } from '../components/ui/Button';
import { Chip, ChipText, Input } from '../components/ui/Field';
import { ErrorState, InlineError, Loading, Notice } from '../components/ui/Feedback';
import { Screen } from '../components/ui/Screen';
import { Muted, Section, SectionTitle, Strong } from '../components/ui/Typography';
import { MUSCLE_GROUPS, muscleGroupLabel } from '../constants/muscleGroups';
import { getErrorMessage } from '../lib/errors';
import type { MuscleGroup, PlanDaySpec } from '../types/models';
import type { RootScreenProps } from '../navigation/types';
import { color, font, radius, space } from '../theme/theme';

/**
 * Divisões prontas, do mais simples ao mais fracionado.
 *
 * São só pontos de partida: qualquer uma pode ser editada antes de
 * gerar, e o usuário pode montar a própria do zero.
 */
const PRESETS: { id: string; label: string; hint: string; days: PlanDaySpec[] }[] = [
  {
    id: 'ab',
    label: '2 dias · A/B',
    hint: 'Superior e inferior',
    days: [
      { name: 'Dia 1', focus: 'Superiores', groups: ['PEITO', 'COSTAS', 'OMBROS', 'BICEPS', 'TRICEPS'] },
      { name: 'Dia 2', focus: 'Inferiores', groups: ['QUADRICEPS', 'POSTERIOR', 'GLUTEOS', 'PANTURRILHA'] },
    ],
  },
  {
    id: 'ppl',
    label: '3 dias · Push/Pull/Legs',
    hint: 'Empurrar, puxar e pernas',
    days: [
      { name: 'Dia 1', focus: 'Peito, Ombro e Tríceps', groups: ['PEITO', 'OMBROS', 'TRICEPS'] },
      { name: 'Dia 2', focus: 'Costas e Bíceps', groups: ['COSTAS', 'BICEPS'] },
      { name: 'Dia 3', focus: 'Pernas', groups: ['QUADRICEPS', 'POSTERIOR', 'GLUTEOS', 'PANTURRILHA'] },
    ],
  },
  {
    id: 'abcd',
    label: '4 dias · A/B/C/D',
    hint: 'Divisão clássica de hipertrofia',
    days: [
      { name: 'Dia 1', focus: 'Peito, Ombro e Tríceps', groups: ['PEITO', 'OMBROS', 'TRICEPS'] },
      { name: 'Dia 2', focus: 'Costas e Bíceps', groups: ['COSTAS', 'BICEPS'] },
      { name: 'Dia 3', focus: 'Pernas', groups: ['QUADRICEPS', 'POSTERIOR', 'PANTURRILHA'] },
      { name: 'Dia 4', focus: 'Ombro e Braços', groups: ['OMBROS', 'BICEPS', 'TRICEPS', 'ABDOMEN'] },
    ],
  },
  {
    id: 'abcde',
    label: '5 dias · Um grupo por dia',
    hint: 'Maior volume por grupo muscular',
    days: [
      { name: 'Dia 1', focus: 'Peito', groups: ['PEITO'] },
      { name: 'Dia 2', focus: 'Costas', groups: ['COSTAS'] },
      { name: 'Dia 3', focus: 'Pernas', groups: ['QUADRICEPS', 'POSTERIOR', 'PANTURRILHA'] },
      { name: 'Dia 4', focus: 'Ombros', groups: ['OMBROS', 'TRAPEZIO'] },
      { name: 'Dia 5', focus: 'Braços', groups: ['BICEPS', 'TRICEPS', 'ANTEBRACO'] },
    ],
  },
];

/**
 * Geração automática da divisão.
 *
 * O gerador escolhe entre os exercícios do CATÁLOGO DO USUÁRIO —
 * ele não inventa exercícios. Por isso a tela mostra, antes de
 * gerar, quantos exercícios existem de cada grupo escolhido.
 *
 * As cargas nascem em branco de propósito: o sistema não tem como
 * saber quanto você levanta.
 */
export default function CycleGeneratorScreen({ navigation, route }: RootScreenProps<'CycleGenerator'>) {
  const { workoutId } = route.params;
  const theme = useTheme();
  const toast = useToast();

  const { data: workout, isPending, isError, error } = useWorkout(workoutId);
  const { data: counts } = useExerciseCountsByGroup();
  const importStarter = useImportStarterExercises();
  const generatePlan = useGenerateWorkoutPlan();

  const [days, setDays] = useState<PlanDaySpec[]>(PRESETS[1]?.days ?? []);
  const [presetId, setPresetId] = useState<string>('ppl');
  const [perGroup, setPerGroup] = useState('3');
  const [formError, setFormError] = useState<string | null>(null);

  const catalogSize = useMemo(() => Object.values(counts ?? {}).reduce((sum, n) => sum + n, 0), [counts]);

  /** Quantos exercícios a geração vai realmente conseguir prescrever. */
  const projected = useMemo(() => {
    const limit = Number(perGroup) || 0;
    return days.reduce(
      (total, day) => total + day.groups.reduce((sum, group) => sum + Math.min(counts?.[group] ?? 0, limit), 0),
      0,
    );
  }, [days, perGroup, counts]);

  if (isPending) return <Loading message="Carregando ficha…" fullScreen />;

  if (isError || !workout) {
    return (
      <Screen>
        <ErrorState message={getErrorMessage(error, 'Não foi possível carregar a ficha.')} />
      </Screen>
    );
  }

  // Gerar sobre uma ficha com dias apagaria o histórico; o serviço
  // recusa e aqui explicamos antes de tentar.
  if (workout.days.length > 0) {
    return (
      <Screen>
        <ErrorState
          title="Esta ficha já tem uma divisão"
          message="A geração automática só funciona em ficha vazia, para não apagar os dias e o histórico que já existem. Crie uma ficha nova, ou edite a divisão atual manualmente."
          action={
            <Button variant="secondary" onPress={() => navigation.replace('CycleEditor', { workoutId })}>
              Editar divisão atual
            </Button>
          }
        />
      </Screen>
    );
  }

  function applyPreset(id: string) {
    const preset = PRESETS.find((item) => item.id === id);
    if (!preset) return;
    setPresetId(id);
    setDays(preset.days.map((day) => ({ ...day, groups: [...day.groups] })));
    setFormError(null);
  }

  function toggleGroup(dayIndex: number, group: MuscleGroup) {
    setPresetId('custom');
    setDays((current) =>
      current.map((day, index) => {
        if (index !== dayIndex) return day;
        const has = day.groups.includes(group);
        return { ...day, groups: has ? day.groups.filter((g) => g !== group) : [...day.groups, group] };
      }),
    );
    setFormError(null);
  }

  function updateDayField(dayIndex: number, field: 'name' | 'focus', value: string) {
    setPresetId('custom');
    setDays((current) => current.map((day, index) => (index === dayIndex ? { ...day, [field]: value } : day)));
  }

  function addDay() {
    if (days.length >= 7) return;
    setPresetId('custom');
    setDays((current) => [...current, { name: `Dia ${current.length + 1}`, focus: '', groups: [] }]);
  }

  function removeDay(index: number) {
    setPresetId('custom');
    setDays((current) => current.filter((_, i) => i !== index));
  }

  async function handleImport() {
    try {
      const created = await importStarter.mutateAsync();
      toast.showSuccess(
        created > 0
          ? `${created} exercícios adicionados ao seu catálogo.`
          : 'Seu catálogo já tem todos os exercícios básicos.',
      );
    } catch (caught) {
      toast.showError(getErrorMessage(caught, 'Não foi possível importar o catálogo.'));
    }
  }

  async function handleGenerate() {
    const limit = Number(perGroup);
    if (!Number.isInteger(limit) || limit < 1 || limit > 10) {
      setFormError('Informe entre 1 e 10 exercícios por grupo muscular.');
      return;
    }
    if (days.length === 0) {
      setFormError('Adicione ao menos um dia.');
      return;
    }
    if (days.some((day) => day.groups.length === 0)) {
      setFormError('Cada dia precisa de pelo menos um grupo muscular.');
      return;
    }

    setFormError(null);
    try {
      const total = await generatePlan.mutateAsync({ workoutId, days, exercisesPerGroup: limit });

      if (total === 0) {
        toast.showError('Nenhum exercício foi adicionado: seu catálogo não tem exercícios dos grupos escolhidos.');
        return;
      }

      toast.showSuccess(
        `Divisão criada: ${days.length} dias e ${total} exercícios. Ajuste as cargas no primeiro treino.`,
      );
      navigation.replace('CycleEditor', { workoutId });
    } catch (caught) {
      setFormError(getErrorMessage(caught, 'Não foi possível gerar a divisão.'));
    }
  }

  return (
    <Screen subtitle={workout.name}>
      {/* ---- Catálogo ---- */}
      {catalogSize < 10 && (
        <Section>
          <Notice tone="warning">
            <WarningTitle>{catalogSize === 0 ? 'Seu catálogo está vazio' : 'Seu catálogo está pequeno'}</WarningTitle>
            <Muted>
              A geração escolhe entre os exercícios que você já tem cadastrados — ela não inventa exercícios.
              Importe o catálogo básico para ter de onde escolher.
            </Muted>
            <Button variant="secondary" fullWidth onPress={() => void handleImport()} loading={importStarter.isPending}>
              {importStarter.isPending ? 'Importando…' : 'Importar catálogo básico'}
            </Button>
          </Notice>
        </Section>
      )}

      {/* ---- Divisões prontas ---- */}
      <Section>
        <SectionTitle>Divisão</SectionTitle>
        <Presets>
          {PRESETS.map((preset) => (
            <Preset
              key={preset.id}
              $active={presetId === preset.id}
              onPress={() => applyPreset(preset.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: presetId === preset.id }}
            >
              <PresetLabel>{preset.label}</PresetLabel>
              <PresetHint>{preset.hint}</PresetHint>
            </Preset>
          ))}
        </Presets>
      </Section>

      {/* ---- Dias ---- */}
      <Section>
        <SectionHeader>
          <SectionTitle style={{ marginBottom: 0 }}>{`${days.length} ${days.length === 1 ? 'dia' : 'dias'}`}</SectionTitle>
          <Button size="sm" variant="secondary" onPress={addDay} disabled={days.length >= 7}>
            Adicionar dia
          </Button>
        </SectionHeader>

        <DayList>
          {days.map((day, index) => (
            <DayCard key={index}>
              <DayHead>
                <DayInput
                  value={day.name}
                  onChangeText={(text: string) => updateDayField(index, 'name', text)}
                  accessibilityLabel={`Nome do dia ${index + 1}`}
                  maxLength={60}
                  placeholderTextColor={theme.colors.textSubtle}
                />
                <Pressable onPress={() => removeDay(index)} accessibilityLabel={`Remover ${day.name}`} hitSlop={10}>
                  <Ionicons name="close" size={20} color={theme.colors.textMuted} />
                </Pressable>
              </DayHead>

              <FocusInput
                value={day.focus}
                onChangeText={(text: string) => updateDayField(index, 'focus', text)}
                placeholder="Foco muscular (ex.: Peito e Ombro)"
                placeholderTextColor={theme.colors.textSubtle}
                accessibilityLabel={`Foco do dia ${index + 1}`}
                maxLength={120}
              />

              <Groups>
                {MUSCLE_GROUPS.map((group) => {
                  const selected = day.groups.includes(group);
                  const available = counts?.[group] ?? 0;

                  return (
                    <Chip
                      key={group}
                      $selected={selected}
                      onPress={() => toggleGroup(index, group)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      style={selected && available === 0 ? { borderColor: theme.colors.warning } : undefined}
                    >
                      <ChipText $selected={selected}>{muscleGroupLabel(group)}</ChipText>
                      {/* O contador é o que evita gerar no escuro:
                          "Peito 0" mostra na hora que não há de onde
                          escolher naquele grupo. */}
                      <GroupCount $empty={available === 0}>{available}</GroupCount>
                    </Chip>
                  );
                })}
              </Groups>
            </DayCard>
          ))}
        </DayList>
      </Section>

      {/* ---- Ajustes ---- */}
      <Section>
        <Input
          label="Exercícios por grupo muscular"
          value={perGroup}
          onChangeText={setPerGroup}
          keyboardType="number-pad"
          hint="Entre 1 e 10. Um dia com 2 grupos e 3 por grupo terá 6 exercícios."
        />
      </Section>

      {/* ---- Prévia e ação ---- */}
      <Section>
        <Notice>
          <Muted>
            Serão criados <Strong>{days.length}</Strong> {days.length === 1 ? 'dia' : 'dias'} com{' '}
            <Strong>{projected}</Strong> {projected === 1 ? 'exercício' : 'exercícios'} ao todo.
          </Muted>
          <Muted>As cargas ficam em branco — você define no primeiro treino de cada exercício.</Muted>
        </Notice>
      </Section>

      {formError && <InlineError message={formError} />}

      <Actions>
        <Button
          size="lg"
          fullWidth
          onPress={() => void handleGenerate()}
          loading={generatePlan.isPending}
          disabled={projected === 0}
        >
          {generatePlan.isPending ? 'Gerando…' : 'Gerar divisão'}
        </Button>

        {projected === 0 && (
          <Muted style={{ textAlign: 'center' }}>
            Nenhum exercício seria adicionado. Escolha grupos que tenham exercícios no seu catálogo, ou importe o
            catálogo básico.
          </Muted>
        )}
      </Actions>
    </Screen>
  );
}

const WarningTitle = styled.Text`
  color: ${color('warning')};
  font-size: ${font('base')};
  font-weight: 700;
`;

const Presets = styled.View`
  gap: ${space(2)};
`;

const Preset = styled.Pressable<{ $active: boolean }>`
  padding: ${space(3)} ${space(4)};
  border-radius: ${radius('md')};
  border-width: 1px;
  border-color: ${({ theme, $active }) => ($active ? theme.colors.accent : theme.colors.border)};
  background-color: ${({ theme, $active }) => ($active ? theme.colors.accentSoft : theme.colors.surface)};
`;

const PresetLabel = styled.Text`
  color: ${color('text')};
  font-size: ${font('base')};
  font-weight: 700;
`;

const PresetHint = styled.Text`
  color: ${color('textMuted')};
  font-size: ${font('xs')};
  margin-top: 2px;
`;

const SectionHeader = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${space(3)};
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

const DayHead = styled.View`
  flex-direction: row;
  align-items: center;
  gap: ${space(3)};
`;

const DayInput = styled.TextInput`
  flex: 1;
  color: ${color('text')};
  font-size: ${font('lg')};
  font-weight: 700;
  padding: ${space(1)} 0;
`;

const FocusInput = styled.TextInput`
  color: ${color('text')};
  font-size: ${font('sm')};
  padding: ${space(2)} ${space(3)};
  border-radius: ${radius('sm')};
  border-width: 1px;
  border-color: ${color('border')};
  background-color: ${color('bg')};
`;

const Groups = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  gap: ${space(2)};
`;

const GroupCount = styled.Text<{ $empty: boolean }>`
  color: ${({ theme, $empty }) => ($empty ? theme.colors.warning : theme.colors.textSubtle)};
  font-size: ${font('xs')};
  font-weight: 700;
`;

const Actions = styled.View`
  gap: ${space(3)};
  margin-top: ${space(4)};
`;
