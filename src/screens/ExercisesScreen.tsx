import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import styled, { useTheme } from 'styled-components/native';
import { useCreateExercise, useDeleteExercise, useExercises, useUpdateExercise } from '../hooks/useExercises';
import { useImportStarterExercises } from '../hooks/useGenerator';
import { useDebounce } from '../hooks/useDebounce';
import { useToast } from '../contexts/ToastContext';
import { Button, ButtonCell, ButtonRow, IconButton } from '../components/ui/Button';
import { Chip, ChipSelect, ChipText, Form, Input, TextArea } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState, ErrorState, InlineError, Loading } from '../components/ui/Feedback';
import { Screen } from '../components/ui/Screen';
import { Tag, Wrap } from '../components/ui/Typography';
import { MUSCLE_GROUP_OPTIONS, muscleGroupLabel } from '../constants/muscleGroups';
import { validateExercise } from '../utils/validation';
import type { ExerciseFormValues, FieldErrors } from '../utils/validation';
import { buildWatchUrl, extractVideoId } from '../utils/youtube';
import { getErrorMessage } from '../lib/errors';
import type { Exercise, MuscleGroup } from '../types/models';
import { color, font, radius, space } from '../theme/theme';

const EMPTY_FORM: ExerciseFormValues = { name: '', muscle_group: '', description: '', youtubeUrl: '' };

/** Filtros do topo: "Todos" + os grupos musculares. */
const FILTER_OPTIONS = [{ value: 'ALL' as const, label: 'Todos' }, ...MUSCLE_GROUP_OPTIONS];

/**
 * Catálogo de exercícios: criar, buscar, filtrar, editar e excluir.
 */
export default function ExercisesScreen() {
  const theme = useTheme();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | 'ALL'>('ALL');
  const debouncedSearch = useDebounce(search);

  const { data: exercises, isPending, isError, error, refetch, isRefetching } = useExercises({
    search: debouncedSearch,
    muscleGroup,
  });

  const createExercise = useCreateExercise();
  const updateExercise = useUpdateExercise();
  const deleteExercise = useDeleteExercise();
  const importStarter = useImportStarterExercises();

  // `editing` guarda o exercício em edição; null significa criação.
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [values, setValues] = useState<ExerciseFormValues>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<ExerciseFormValues>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Exercise | null>(null);

  const saving = createExercise.isPending || updateExercise.isPending;

  function openCreate() {
    setEditing(null);
    setValues(EMPTY_FORM);
    setFieldErrors({});
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(exercise: Exercise) {
    setEditing(exercise);
    setValues({
      name: exercise.name,
      muscle_group: exercise.muscle_group,
      description: exercise.description ?? '',
      // Reconstruímos a URL a partir do ID guardado, para o campo
      // mostrar algo familiar.
      youtubeUrl: exercise.youtube_video_id ? buildWatchUrl(exercise.youtube_video_id) : '',
    });
    setFieldErrors({});
    setFormError(null);
    setFormOpen(true);
  }

  const update = (field: keyof ExerciseFormValues) => (text: string) => {
    setValues((current) => ({ ...current, [field]: text }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  };

  async function handleSubmit() {
    const errors = validateExercise(values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const input = {
      name: values.name,
      description: values.description || null,
      muscle_group: values.muscle_group as MuscleGroup,
      youtube_video_id: extractVideoId(values.youtubeUrl),
    };

    setFormError(null);
    try {
      if (editing) {
        await updateExercise.mutateAsync({ id: editing.id, input });
        toast.showSuccess('Exercício atualizado com sucesso.');
      } else {
        await createExercise.mutateAsync(input);
        toast.showSuccess('Exercício criado com sucesso.');
      }
      setFormOpen(false);
    } catch (caught) {
      setFormError(getErrorMessage(caught, 'Não foi possível salvar o exercício.'));
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteExercise.mutateAsync(deleteTarget.id);
      toast.showSuccess('Exercício excluído.');
    } catch (caught) {
      // Caso mais comum: o exercício está em uso em alguma ficha.
      toast.showError(getErrorMessage(caught, 'Não foi possível excluir o exercício.'));
    } finally {
      setDeleteTarget(null);
    }
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

  const isFiltering = debouncedSearch.trim() !== '' || muscleGroup !== 'ALL';

  return (
    <Screen
      subtitle="Seu catálogo, reutilizável entre os ciclos"
      action={
        <Button size="sm" onPress={openCreate}>
          Novo
        </Button>
      }
      onRefresh={() => void refetch()}
      refreshing={isRefetching}
    >
      <Filters>
        <SearchBox>
          <Ionicons name="search" size={18} color={theme.colors.textSubtle} />
          <SearchInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar exercício…"
            placeholderTextColor={theme.colors.textSubtle}
            accessibilityLabel="Buscar exercício pelo nome"
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
      </Filters>

      {isPending && <Loading message="Carregando exercícios…" />}

      {isError && (
        <ErrorState
          message={getErrorMessage(error, 'Não foi possível carregar os exercícios.')}
          action={
            <Button variant="secondary" onPress={() => void refetch()}>
              Tentar novamente
            </Button>
          }
        />
      )}

      {!isPending && !isError && exercises?.length === 0 && (
        <EmptyState
          title={isFiltering ? 'Nenhum resultado' : 'Nenhum exercício cadastrado'}
          message={
            isFiltering
              ? 'Tente outro termo de busca ou remova o filtro de grupo muscular.'
              : 'Cadastre o primeiro exercício ou importe um catálogo básico com ~40 exercícios comuns.'
          }
          icon={isFiltering ? 'search-outline' : 'barbell-outline'}
          action={
            !isFiltering ? (
              <>
                <Button onPress={openCreate}>Criar exercício</Button>
                <Button variant="secondary" onPress={() => void handleImport()} loading={importStarter.isPending}>
                  Importar catálogo básico
                </Button>
              </>
            ) : undefined
          }
        />
      )}

      {exercises && exercises.length > 0 && (
        <List>
          {exercises.map((exercise) => (
            <Row key={exercise.id}>
              <RowMain>
                <RowTitle>{exercise.name}</RowTitle>
                <Wrap>
                  <Tag>{muscleGroupLabel(exercise.muscle_group)}</Tag>
                  {exercise.youtube_video_id && <Tag $accent>vídeo</Tag>}
                </Wrap>
              </RowMain>
              <RowActions>
                <IconButton onPress={() => openEdit(exercise)} accessibilityLabel={`Editar ${exercise.name}`}>
                  <Ionicons name="create-outline" size={17} color={theme.colors.textMuted} />
                </IconButton>
                <IconButton
                  $danger
                  onPress={() => setDeleteTarget(exercise)}
                  accessibilityLabel={`Excluir ${exercise.name}`}
                >
                  <Ionicons name="trash-outline" size={17} color={theme.colors.danger} />
                </IconButton>
              </RowActions>
            </Row>
          ))}
        </List>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Editar exercício' : 'Novo exercício'}
        busy={saving}
      >
        <Form>
          {formError && <InlineError message={formError} />}

          <Input
            label="Nome"
            value={values.name}
            onChangeText={update('name')}
            error={fieldErrors.name}
            placeholder="Supino Reto com Barra"
            disabled={saving}
            maxLength={100}
            required
          />

          <ChipSelect
            label="Grupo muscular"
            options={MUSCLE_GROUP_OPTIONS}
            value={values.muscle_group as MuscleGroup | ''}
            onChange={update('muscle_group')}
            error={fieldErrors.muscle_group}
            disabled={saving}
            required
          />

          <TextArea
            label="Descrição"
            value={values.description}
            onChangeText={update('description')}
            error={fieldErrors.description}
            placeholder="Dicas de execução, postura, respiração…"
            hint="Opcional. Aparece na tela de treino."
            disabled={saving}
            maxLength={1000}
          />

          <Input
            label="Vídeo do YouTube"
            value={values.youtubeUrl}
            onChangeText={update('youtubeUrl')}
            error={fieldErrors.youtubeUrl}
            placeholder="https://www.youtube.com/watch?v=..."
            hint="Opcional. Aceita links youtube.com, youtu.be e /shorts."
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            disabled={saving}
          />

          <ButtonRow>
            <ButtonCell>
              <Button variant="secondary" onPress={() => setFormOpen(false)} disabled={saving} fullWidth>
                Cancelar
              </Button>
            </ButtonCell>
            <ButtonCell>
              <Button onPress={() => void handleSubmit()} loading={saving} fullWidth>
                {saving ? 'Salvando…' : 'Salvar'}
              </Button>
            </ButtonCell>
          </ButtonRow>
        </Form>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Excluir exercício"
        message={
          deleteTarget
            ? `Tem certeza que deseja excluir "${deleteTarget.name}"? Esta ação não pode ser desfeita.`
            : ''
        }
        loading={deleteExercise.isPending}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </Screen>
  );
}

const Filters = styled.View`
  gap: ${space(3)};
  margin-bottom: ${space(4)};
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
  background-color: ${color('surface')};
`;

const SearchInput = styled.TextInput`
  flex: 1;
  color: ${color('text')};
  font-size: ${font('base')};
  padding: ${space(3)} 0;
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
  gap: ${space(2)};
`;

const RowTitle = styled.Text`
  color: ${color('text')};
  font-size: ${font('base')};
  font-weight: 600;
`;

const RowActions = styled.View`
  flex-direction: row;
  gap: ${space(2)};
`;
