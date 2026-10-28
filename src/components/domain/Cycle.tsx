import { Ionicons } from '@expo/vector-icons';
import styled, { useTheme } from 'styled-components/native';
import type { DefaultTheme } from 'styled-components/native';
import type { CycleStatus, WorkoutSummary } from '../../types/models';
import {
  CYCLE_STATUS_LABELS,
  computeProgress,
  describeRemaining,
  formatPeriod,
} from '../../utils/cycle';
import { pluralize } from '../../utils/format';
import { color, font, radius, space } from '../../theme/theme';

function statusColors(theme: DefaultTheme, status: CycleStatus) {
  switch (status) {
    case 'active':
      return { fg: theme.colors.accent, bg: theme.colors.accentSoft };
    case 'upcoming':
      return { fg: theme.colors.info, bg: theme.colors.infoSoft };
    case 'expired':
      return { fg: theme.colors.warning, bg: theme.colors.warningSoft };
    default:
      return { fg: theme.colors.textMuted, bg: theme.colors.surfaceRaised };
  }
}

/**
 * Selo do estado do ciclo.
 *
 * A cor sozinha não carrega o significado — o texto sempre aparece
 * junto. Quem não distingue verde de cinza continua lendo "Ativa"
 * ou "Encerrada".
 */
export function CycleBadge({ status }: { status: CycleStatus }) {
  const theme = useTheme();
  const { fg, bg } = statusColors(theme, status);

  return (
    <Badge style={{ backgroundColor: bg }}>
      <Dot style={{ backgroundColor: fg }} />
      <BadgeText style={{ color: fg }}>{CYCLE_STATUS_LABELS[status]}</BadgeText>
    </Badge>
  );
}

interface ProgressBarProps {
  /** 0 a 100. */
  percent: number;
  label?: string;
  /** Texto à direita. Sem ele, mostra o percentual. */
  value?: string;
  large?: boolean;
}

export function ProgressBar({ percent, label, value, large = false }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));

  return (
    <ProgressWrapper
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Progresso'}
      accessibilityValue={{ min: 0, max: 100, now: clamped }}
    >
      {(label || value) && (
        <ProgressHeader>
          {label ? <ProgressLabel>{label}</ProgressLabel> : <ProgressLabel />}
          <ProgressValue>{value ?? `${clamped}%`}</ProgressValue>
        </ProgressHeader>
      )}
      <Track $large={large}>
        <Fill style={{ width: `${clamped}%` }} />
      </Track>
    </ProgressWrapper>
  );
}

interface CycleCardProps {
  workout: WorkoutSummary;
  onPress: () => void;
}

/**
 * Card de ficha na listagem.
 *
 * O card inteiro é tocável, e não um card com um botão dentro: numa
 * tela pequena, o alvo de toque passa a ser toda a área do card.
 *
 * A barra de progresso só aparece no ciclo ativo: num ciclo futuro
 * ela seria sempre 0% e num encerrado sempre 100%.
 */
export function CycleCard({ workout, onPress }: CycleCardProps) {
  const theme = useTheme();
  const progress = computeProgress(workout);
  const isActive = workout.status === 'active';

  return (
    <CardPressable
      $active={isActive}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Ficha ${workout.name}, ${CYCLE_STATUS_LABELS[workout.status]}`}
    >
      <CardHeader>
        <CardTitles>
          <CardName>{workout.name}</CardName>
          {workout.description ? <CardDescription numberOfLines={2}>{workout.description}</CardDescription> : null}
        </CardTitles>
        <CycleBadge status={workout.status} />
      </CardHeader>

      <Period>
        <Ionicons name="calendar-outline" size={14} color={theme.colors.textMuted} />
        <PeriodText>{formatPeriod(workout)}</PeriodText>
      </Period>

      {isActive && (
        <>
          <Remaining>{describeRemaining(workout, workout.status)}</Remaining>
          <ProgressBar
            percent={progress.percent}
            label="Progresso do ciclo"
            value={`${progress.elapsedDays} de ${progress.totalDays} dias`}
          />
        </>
      )}

      <Meta>
        <MetaChip>
          <MetaStrong>{workout.exerciseCount}</MetaStrong>{' '}
          {workout.exerciseCount === 1 ? 'exercício' : 'exercícios'}
        </MetaChip>
        <MetaChip>
          <MetaStrong>{workout.sessionCount}</MetaStrong>{' '}
          {workout.sessionCount === 1 ? 'treino feito' : 'treinos feitos'}
        </MetaChip>
        {workout.session_goal !== null && (
          <MetaChip>
            meta <MetaStrong>{workout.session_goal}</MetaStrong>
          </MetaChip>
        )}
      </Meta>
    </CardPressable>
  );
}

/** Contagem de treinos, com ou sem meta definida. */
export function describeSessions(count: number, goal: number | null): string {
  // Sem meta, mostramos só o número absoluto. Inventar um
  // denominador daria ao usuário um percentual que não corresponde
  // a nenhuma decisão dele.
  if (goal === null) return pluralize(count, 'treino realizado', 'treinos realizados');
  return `${count} de ${goal} treinos`;
}

const Badge = styled.View`
  flex-direction: row;
  align-items: center;
  align-self: flex-start;
  gap: 6px;
  padding: 4px ${space(3)};
  border-radius: ${radius('full')};
`;

const Dot = styled.View`
  width: 6px;
  height: 6px;
  border-radius: 3px;
`;

const BadgeText = styled.Text`
  font-size: ${font('xs')};
  font-weight: 700;
`;

const ProgressWrapper = styled.View`
  gap: ${space(2)};
`;

const ProgressHeader = styled.View`
  flex-direction: row;
  justify-content: space-between;
`;

const ProgressLabel = styled.Text`
  color: ${color('textMuted')};
  font-size: ${font('xs')};
  font-weight: 600;
`;

const ProgressValue = styled.Text`
  color: ${color('text')};
  font-size: ${font('xs')};
  font-weight: 700;
`;

const Track = styled.View<{ $large: boolean }>`
  height: ${({ $large }) => ($large ? '10px' : '6px')};
  border-radius: ${radius('full')};
  overflow: hidden;
  background-color: ${color('surfaceRaised')};
`;

const Fill = styled.View`
  height: 100%;
  border-radius: ${radius('full')};
  background-color: ${color('accent')};
`;

const CardPressable = styled.Pressable<{ $active: boolean }>`
  padding: ${space(4)};
  gap: ${space(3)};
  border-radius: ${radius('lg')};
  border-width: 1px;
  border-color: ${({ theme, $active }) => ($active ? theme.colors.accentBorder : theme.colors.border)};
  background-color: ${color('surface')};
`;

const CardHeader = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: flex-start;
  gap: ${space(3)};
`;

const CardTitles = styled.View`
  flex: 1;
  gap: ${space(1)};
`;

const CardName = styled.Text`
  color: ${color('text')};
  font-size: ${font('lg')};
  font-weight: 700;
`;

const CardDescription = styled.Text`
  color: ${color('textMuted')};
  font-size: ${font('sm')};
`;

const Period = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 6px;
`;

const PeriodText = styled.Text`
  color: ${color('textMuted')};
  font-size: ${font('sm')};
`;

const Remaining = styled.Text`
  color: ${color('accent')};
  font-size: ${font('sm')};
  font-weight: 600;
`;

const Meta = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  gap: ${space(2)};
`;

const MetaChip = styled.Text`
  overflow: hidden;
  padding: 4px ${space(3)};
  border-radius: ${radius('full')};
  color: ${color('textMuted')};
  font-size: ${font('xs')};
  background-color: ${color('surfaceRaised')};
`;

const MetaStrong = styled.Text`
  color: ${color('text')};
  font-weight: 700;
`;
