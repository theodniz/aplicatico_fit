import { useState } from 'react';
import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import styled, { useTheme } from 'styled-components/native';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../contexts/ToastContext';
import { Button } from '../components/ui/Button';
import { Form, Input } from '../components/ui/Field';
import { Loading } from '../components/ui/Feedback';
import { Screen } from '../components/ui/Screen';
import { Section, SectionTitle } from '../components/ui/Typography';
import { useAppNavigation } from '../navigation/types';
import { changeOwnPassword, updateOwnName } from '../services/auth';
import { getErrorMessage } from '../lib/errors';
import { initials } from '../utils/format';
import { color, font, radius, space } from '../theme/theme';

/**
 * Perfil do usuário: dados, troca de senha e saída.
 *
 * Um usuário comum só consegue alterar o próprio nome e a própria
 * senha. O papel não aparece como campo editável — e mesmo que
 * alguém forjasse a requisição, as regras do Firestore recusariam.
 */
export default function ProfileScreen() {
  const navigation = useAppNavigation();
  const { profile, isAdmin, signOut, refreshProfile } = useAuth();
  const toast = useToast();

  const [name, setName] = useState(profile?.name ?? '');
  const [savingName, setSavingName] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [savingPassword, setSavingPassword] = useState(false);

  const [signingOut, setSigningOut] = useState(false);

  if (!profile) return <Loading message="Carregando perfil…" fullScreen />;

  async function handleSaveName() {
    if (!profile) return;
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.showError('O nome precisa ter pelo menos 2 caracteres.');
      return;
    }

    setSavingName(true);
    try {
      await updateOwnName(profile.id, trimmed);
      await refreshProfile();
      toast.showSuccess('Nome atualizado com sucesso.');
    } catch (error) {
      toast.showError(getErrorMessage(error, 'Não foi possível salvar seu nome.'));
    } finally {
      setSavingName(false);
    }
  }

  async function handleChangePassword() {
    setPasswordError(undefined);

    if (!currentPassword) {
      setPasswordError('Informe sua senha atual.');
      return;
    }
    if (password.length < 6) {
      setPasswordError('A nova senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== passwordConfirm) {
      setPasswordError('As senhas não conferem.');
      return;
    }

    setSavingPassword(true);
    try {
      await changeOwnPassword(currentPassword, password);
      setCurrentPassword('');
      setPassword('');
      setPasswordConfirm('');
      toast.showSuccess('Senha alterada com sucesso.');
    } catch (error) {
      setPasswordError(getErrorMessage(error, 'Não foi possível alterar a senha.'));
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      // O RootNavigator volta para o login assim que a sessão cai.
    } catch (error) {
      toast.showError(getErrorMessage(error, 'Não foi possível sair.'));
      setSigningOut(false);
    }
  }

  return (
    <Screen>
      <Identity>
        <Avatar>
          <AvatarText>{initials(profile.name)}</AvatarText>
        </Avatar>
        <IdentityText>
          <Name>{profile.name}</Name>
          <Email>{profile.email}</Email>
          {isAdmin && <AdminBadge>Administrador</AdminBadge>}
        </IdentityText>
      </Identity>

      <Links>
        <MenuLink icon="stats-chart-outline" label="Minha evolução" onPress={() => navigation.navigate('Progress')} />
        {/* Administração de CONTAS. Não dá acesso a treino de
            ninguém — o isolamento vale também para o admin. */}
        {isAdmin && (
          <MenuLink icon="people-outline" label="Gerenciar usuários" onPress={() => navigation.navigate('AdminUsers')} />
        )}
      </Links>

      <Section>
        <SectionTitle>Seus dados</SectionTitle>
        <Form>
          <Input
            label="Nome"
            value={name}
            onChangeText={setName}
            autoComplete="name"
            disabled={savingName}
            maxLength={80}
            required
          />
          <Button
            onPress={() => void handleSaveName()}
            loading={savingName}
            disabled={name.trim() === profile.name}
            fullWidth
          >
            {savingName ? 'Salvando…' : 'Salvar nome'}
          </Button>
        </Form>
      </Section>

      <Section>
        <SectionTitle>Alterar senha</SectionTitle>
        <Form>
          <Input
            label="Senha atual"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            disabled={savingPassword}
            required
          />
          <Input
            label="Nova senha"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            hint="Mínimo de 6 caracteres."
            disabled={savingPassword}
            required
          />
          <Input
            label="Confirmar nova senha"
            value={passwordConfirm}
            onChangeText={setPasswordConfirm}
            error={passwordError}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            disabled={savingPassword}
            required
          />
          <Button
            variant="secondary"
            onPress={() => void handleChangePassword()}
            loading={savingPassword}
            disabled={!password && !passwordConfirm}
            fullWidth
          >
            {savingPassword ? 'Alterando…' : 'Alterar senha'}
          </Button>
        </Form>
      </Section>

      <Button variant="dangerOutline" onPress={() => void handleSignOut()} loading={signingOut} fullWidth size="lg">
        {signingOut ? 'Saindo…' : 'Sair da conta'}
      </Button>
    </Screen>
  );
}

function MenuLink({
  icon,
  label,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <LinkRow onPress={onPress} accessibilityRole="button">
      <LinkIcon>
        <Ionicons name={icon} size={18} color={theme.colors.accent} />
      </LinkIcon>
      <LinkText>{label}</LinkText>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.textSubtle} />
    </LinkRow>
  );
}

const Identity = styled.View`
  flex-direction: row;
  align-items: center;
  gap: ${space(4)};
  padding: ${space(4)};
  margin-bottom: ${space(4)};
  border-radius: ${radius('lg')};
  border-width: 1px;
  border-color: ${color('border')};
  background-color: ${color('surface')};
`;

const Avatar = styled.View`
  width: 56px;
  height: 56px;
  border-radius: 28px;
  align-items: center;
  justify-content: center;
  background-color: ${color('accentSoft')};
`;

const AvatarText = styled.Text`
  color: ${color('accent')};
  font-size: ${font('lg')};
  font-weight: 800;
`;

const IdentityText = styled.View`
  flex: 1;
  gap: 2px;
`;

const Name = styled.Text`
  color: ${color('text')};
  font-size: ${font('lg')};
  font-weight: 700;
`;

const Email = styled.Text`
  color: ${color('textMuted')};
  font-size: ${font('sm')};
`;

const AdminBadge = styled.Text`
  align-self: flex-start;
  overflow: hidden;
  margin-top: ${space(1)};
  padding: 2px ${space(2)};
  border-radius: 6px;
  color: ${color('accent')};
  background-color: ${color('accentSoft')};
  font-size: ${font('xs')};
  font-weight: 700;
`;

const Links = styled.View`
  gap: ${space(2)};
  margin-bottom: ${space(6)};
`;

const LinkRow = styled.Pressable`
  flex-direction: row;
  align-items: center;
  gap: ${space(3)};
  padding: ${space(3)} ${space(4)};
  border-radius: ${radius('md')};
  border-width: 1px;
  border-color: ${color('border')};
  background-color: ${color('surface')};
`;

const LinkIcon = styled.View`
  width: 32px;
  height: 32px;
  border-radius: ${radius('sm')};
  align-items: center;
  justify-content: center;
  background-color: ${color('accentSoft')};
`;

const LinkText = styled.Text`
  flex: 1;
  color: ${color('text')};
  font-size: ${font('base')};
  font-weight: 600;
`;
