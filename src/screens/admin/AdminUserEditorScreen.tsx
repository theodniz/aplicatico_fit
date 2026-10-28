import { useState } from 'react';
import { useCreateUser, useUpdateUser, useUser } from '../../hooks/useUsers';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../../components/ui/Button';
import { ChipSelect, Form, Input } from '../../components/ui/Field';
import { ErrorState, InlineError, Loading, Notice } from '../../components/ui/Feedback';
import { Screen } from '../../components/ui/Screen';
import { Section, SectionTitle } from '../../components/ui/Typography';
import { validateUser } from '../../utils/validation';
import type { FieldErrors, UserFormValues } from '../../utils/validation';
import { getErrorMessage } from '../../lib/errors';
import type { UserRole } from '../../types/models';
import type { RootScreenProps } from '../../navigation/types';

const ROLE_OPTIONS = [
  { value: 'USER' as const, label: 'Usuário — acessa apenas os próprios treinos' },
  { value: 'ADMIN' as const, label: 'Administrador — também gerencia as contas' },
];

/**
 * Criação e edição de usuário.
 *
 * A mesma tela cobre os dois casos: sem `userId` é criação, com
 * `userId` é edição.
 */
export default function AdminUserEditorScreen({ navigation, route }: RootScreenProps<'AdminUserEditor'>) {
  const userId = route.params?.userId;
  const isEditing = Boolean(userId);

  const toast = useToast();
  const { profile: currentUser, refreshProfile } = useAuth();

  const { data: user, isPending: loadingUser, isError, error } = useUser(userId);
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();

  const [form, setForm] = useState<UserFormValues | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<UserFormValues>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Enquanto o admin não digitou nada, o formulário espelha o dado
  // vindo do servidor.
  const values: UserFormValues = form ?? {
    name: user?.name ?? '',
    email: user?.email ?? '',
    password: '',
    role: user?.role ?? 'USER',
  };

  if (isEditing && loadingUser) return <Loading message="Carregando usuário…" fullScreen />;

  if (isEditing && isError) {
    return (
      <Screen>
        <ErrorState message={getErrorMessage(error, 'Não foi possível carregar o usuário.')} />
      </Screen>
    );
  }

  const update = (field: keyof UserFormValues) => (text: string) => {
    setForm({ ...values, [field]: text });
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  };

  async function handleSubmit() {
    const errors = validateUser(values, { requirePassword: !isEditing });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setFormError(null);
    try {
      if (isEditing && userId) {
        await updateUser.mutateAsync({ id: userId, name: values.name, role: values.role as UserRole });
        if (userId === currentUser?.id) await refreshProfile();
        toast.showSuccess('Usuário atualizado.');
        setForm(null);
      } else {
        await createUser.mutateAsync({
          name: values.name,
          email: values.email,
          password: values.password,
          role: values.role as UserRole,
        });
        toast.showSuccess('Usuário criado. Já pode fazer login.');
        navigation.goBack();
      }
    } catch (caught) {
      setFormError(getErrorMessage(caught, 'Não foi possível salvar o usuário.'));
    }
  }

  const saving = createUser.isPending || updateUser.isPending;
  const isEditingSelf = isEditing && userId === currentUser?.id;

  return (
    <Screen>
      <Section>
        <SectionTitle>Dados da conta</SectionTitle>
        <Form>
          {formError && <InlineError message={formError} />}

          <Input
            label="Nome"
            value={values.name}
            onChangeText={update('name')}
            error={fieldErrors.name}
            placeholder="João da Silva"
            autoComplete="name"
            disabled={saving}
            maxLength={80}
            required
          />

          <Input
            label="E-mail"
            value={values.email}
            onChangeText={update('email')}
            error={fieldErrors.email}
            placeholder="joao@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            // O e-mail é a identidade no Firebase Auth; alterá-lo de
            // outra pessoa exigiria o Admin SDK, que não roda no app.
            disabled={saving || isEditing}
            hint={isEditing ? 'O e-mail não pode ser alterado depois da criação.' : undefined}
            required
          />

          {!isEditing && (
            <Input
              label="Senha inicial"
              value={values.password}
              onChangeText={update('password')}
              error={fieldErrors.password}
              hint="Mínimo de 6 caracteres. O usuário pode trocar depois no perfil."
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              disabled={saving}
              required
            />
          )}

          <ChipSelect
            label="Perfil de acesso"
            options={ROLE_OPTIONS}
            value={values.role as UserRole}
            onChange={update('role')}
            error={fieldErrors.role}
            // Rebaixar a si mesmo travaria a área administrativa. As
            // regras do Firestore também impedem.
            disabled={saving || isEditingSelf}
            hint={isEditingSelf ? 'Você não pode alterar o próprio perfil de acesso.' : undefined}
            vertical
            required
          />

          <Button onPress={() => void handleSubmit()} loading={saving} fullWidth>
            {saving ? 'Salvando…' : isEditing ? 'Salvar alterações' : 'Criar usuário'}
          </Button>
        </Form>
      </Section>

      {isEditing && (
        <Notice>
          As fichas e o histórico deste usuário são privados: cada pessoa cria e enxerga apenas os próprios treinos,
          inclusive os administradores.
        </Notice>
      )}
    </Screen>
  );
}
