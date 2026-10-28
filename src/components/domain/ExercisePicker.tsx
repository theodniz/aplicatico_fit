import { useMemo, useState } from 'react';
import { ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import styled, { useTheme } from 'styled-components/native';
import { useExercises } from '../../hooks/useExercises';
import { useDebounce } from '../../hooks/useDebounce';
import { Loading } from '../ui/Feedback';
import { Chip, ChipText } from '../ui/Field';
import { Tag } from '../ui/Typography';
import { MUSCLE_GROUP_OPTIONS, muscleGroupLabel } from '../../constants/muscleGroups';
import type { MuscleGroup } from '../../types/models';
import { color, font, radius, space } from '../../theme/theme';

interface ExercisePickerProps {
  /** Exercício escolhido, ou null. */
  value: string | null;
  onChange: (exerciseId: string) => void;
  /**
   * Exercícios já presentes no dia. Aparecem na lista, marcados e
   * desabilitados: esconder faria o usuário procurar em vão por um
   * exercício que ele mesmo já adicionou.
   */
  usedExerciseIds?: string[];
}

const FILTER_OPTIONS = [{ value: 'ALL' as const, label: 'Todos' }, ...MUSCLE_GROUP_OPTIONS];

/**
 * Seletor de exercício com busca e filtro por grupo muscular.
 *
 * A lista é renderizada com `map`, e não com FlatList: ela vive
 * dentro da ScrollView do modal, e listas virtualizadas aninhadas na
 * mesma direção quebram a rolagem.
 */
export function ExercisePicker({ value, onChange, usedExerciseIds = [] }: ExercisePickerProps) {
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | 'ALL'>('ALL');
  const debouncedSearch = useDebounce(search);

  const { data: exercises, isPending } = useExercises({ search: debouncedSearch, muscleGroup });

  const used = useMemo(() => new Set(usedExerciseIds), [usedExerciseIds]);
  const isFiltering = debouncedSearch.trim() !== '' || muscleGroup !== 'ALL';

  return (
    <Wrapper>
      <SearchBox>
        <Ionicons name="search" size={18} color={theme.colors.textSubtle} />
        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar exercício…"
          placeholderTextColor={theme.colors.textSubtle}
          accessibilityLabel="Buscar exercício pelo nome"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </SearchBox>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {FILTER_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            $selected={muscleGroup === option.value}
            onPress={() => setMuscleGroup(option.value)}
            accessibilityState={{ selected: muscleGroup === option.value }}
          >
            <ChipText $selected={muscleGroup === option.value}>{option.label}</ChipText>
          </Chip>
        ))}
      </ScrollView>

      {isPending && <Loading message="Carregando exercícios…" />}

      {!isPending && (exercises?.length ?? 0) === 0 && (
        <Empty>
          {isFiltering
            ? 'Nenhum exercício encontrado. Tente outro termo ou remova o filtro.'
            : 'Seu catálogo está vazio. Cadastre exercícios ou importe o catálogo básico na aba Exercícios.'}
        </Empty>
      )}

      {exercises && exercises.length > 0 && (
        <List>
          {exercises.map((exercise) => {
            const alreadyUsed = used.has(exercise.id);
            const selected = value === exercise.id;

            return (
              <Item
                key={exercise.id}
                $selected={selected}
                $disabled={alreadyUsed}
                disabled={alreadyUsed}
                onPress={() => onChange(exercise.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected, disabled: alreadyUsed }}
              >
                <ItemMain>
                  <ItemName>{exercise.name}</ItemName>
                  <ItemMeta>
                    <Tag>{muscleGroupLabel(exercise.muscle_group)}</Tag>
                    {alreadyUsed && <Tag $accent>já neste dia</Tag>}
                  </ItemMeta>
                </ItemMain>
                {selected && <Ionicons name="checkmark-circle" size={22} color={theme.colors.accent} />}
              </Item>
            );
          })}
        </List>
      )}
    </Wrapper>
  );
}

const Wrapper = styled.View`
  gap: ${space(3)};
`;

const SearchBox = styled.View`
  flex-direction: row;
  align-items: center;
  gap: ${space(2)};
  padding: 0 ${space(3)};
  min-height: 48px;
  border-radius: ${radius('md')};
  border-width: 1px;
  border-color: ${color('border')};
  background-color: ${color('bg')};
`;

const SearchInput = styled.TextInput`
  flex: 1;
  color: ${color('text')};
  font-size: ${font('base')};
  padding: ${space(3)} 0;
`;

const Empty = styled.Text`
  color: ${color('textMuted')};
  font-size: ${font('sm')};
  line-height: 20px;
  text-align: center;
  padding: ${space(4)} 0;
`;

const List = styled.View`
  gap: ${space(2)};
`;

const Item = styled.Pressable<{ $selected: boolean; $disabled: boolean }>`
  flex-direction: row;
  align-items: center;
  gap: ${space(3)};
  padding: ${space(3)};
  border-radius: ${radius('md')};
  border-width: 1px;
  border-color: ${({ theme, $selected }) => ($selected ? theme.colors.accent : theme.colors.border)};
  background-color: ${({ theme, $selected }) => ($selected ? theme.colors.accentSoft : theme.colors.bg)};
  opacity: ${({ $disabled }) => ($disabled ? 0.5 : 1)};
`;

const ItemMain = styled.View`
  flex: 1;
  gap: ${space(1)};
`;

const ItemName = styled.Text`
  color: ${color('text')};
  font-size: ${font('base')};
  font-weight: 600;
`;

const ItemMeta = styled.View`
  flex-direction: row;
  gap: ${space(2)};
`;
