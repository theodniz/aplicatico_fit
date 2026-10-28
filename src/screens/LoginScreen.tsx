import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import styled, { useTheme } from 'styled-components/native';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../contexts/ToastContext';
import { Input, Form } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { InlineError } from '../components/ui/Feedback';
import { Modal } from '../components/ui/Modal';
import { getErrorMessage } from '../lib/errors';
import { sendPasswordReset } from '../services/auth';
import { validateEmail, validateLogin } from '../utils/validation';
import type { FieldErrors, LoginFormValues } from '../utils/validation';
import type { RootScreenProps } from '../navigation/types';
import { color, font, radius, space } from '../theme/theme';

/**
 * Tela de login.
 *
 * Entrar, recuperar a senha por e-mail e ir para o cadastro. Não
 * navegamos daqui depois do login: quando a sessão abre, o
 * RootNavigator troca o conjunto de telas sozinho.
 */
export default function LoginScreen({ navigation }: RootScreenProps<'Login'>) {
  const theme = useTheme();
  const toast = useToast();
  const { signIn, user, profileError } = useAuth();

  const [values, setValues] = useState<LoginFormValues>({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<LoginFormValues>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const update = (field: keyof LoginFormValues) => (text: string) => {
    setValues((current) => ({ ...current, [field]: text }));
    // Limpa o erro do campo enquanto o usuário corrige, em vez de
    // deixar a mensagem vermelha até ele reenviar o formulário.
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  };

  async function handleSubmit() {
    const errors = validateLogin(values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    setFormError(null);
    try {
      await signIn(values.email, values.password);
    } catch (error) {
      setFormError(getErrorMessage(error, 'Não foi possível entrar. Tente novamente.'));
    } finally {
      setSubmitting(false);
    }
  }

  function openReset() {
    setResetEmail(values.email);
    setResetError(null);
    setResetOpen(true);
  }

  async function handleReset() {
    const error = validateEmail(resetEmail);
    if (error) {
      setResetError(error);
      return;
    }

    setResetting(true);
    try {
      await sendPasswordReset(resetEmail);
      setResetOpen(false);
      // Mensagem neutra de propósito: não confirma se o e-mail tem
      // conta, para a tela não servir de consulta de cadastros.
      toast.showSuccess('Se houver uma conta com este e-mail, você receberá o link de redefinição.');
    } catch (caught) {
      setResetError(getErrorMessage(caught, 'Não foi possível enviar o e-mail.'));
    } finally {
      setResetting(false);
    }
  }

  // Logado no Firebase, mas sem perfil: o Firestore não foi criado ou
  // as regras não foram publicadas. Sem esta mensagem, o login
  // "funcionaria" e nada aconteceria.
  const sessionProblem = user && profileError ? profileError : null;

  return (
    <Safe>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: theme.space[6] }}
          keyboardShouldPersistTaps="handled"
        >
          <Brand>
            <Logo>
              <Ionicons name="barbell" size={36} color={theme.colors.accent} />
            </Logo>
            <AppName>Academia</AppName>
            <Tagline>Entre para acessar suas fichas de treino</Tagline>
          </Brand>

          <Form>
            {formError && <InlineError message={formError} />}
            {sessionProblem && <InlineError message={sessionProblem} />}

            <Input
              label="E-mail"
              value={values.email}
              onChangeText={update('email')}
              error={fieldErrors.email}
              // Ajuda o teclado do celular: layout de e-mail, sem
              // autocorreção nem maiúscula automática.
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              placeholder="seu@email.com"
              returnKeyType="next"
              disabled={submitting}
              required
            />

            <PasswordWrapper>
              <Input
                label="Senha"
                value={values.password}
                onChangeText={update('password')}
                error={fieldErrors.password}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="current-password"
                textContentType="password"
                placeholder="Sua senha"
                returnKeyType="go"
                onSubmitEditing={() => void handleSubmit()}
                disabled={submitting}
                required
              />
              <EyeButton
                onPress={() => setShowPassword((current) => !current)}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                hitSlop={8}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={theme.colors.textMuted}
                />
              </EyeButton>
            </PasswordWrapper>

            <Pressable onPress={openReset} accessibilityRole="link" hitSlop={8} style={{ alignSelf: 'flex-end' }}>
              <LinkText>Esqueci minha senha</LinkText>
            </Pressable>

            <Button size="lg" fullWidth loading={submitting} onPress={() => void handleSubmit()}>
              {submitting ? 'Entrando…' : 'Entrar'}
            </Button>
          </Form>

          <Footer>
            <FooterText>Ainda não tem conta?</FooterText>
            <Pressable onPress={() => navigation.navigate('SignUp')} accessibilityRole="link" hitSlop={8}>
              <LinkText>Criar conta</LinkText>
            </Pressable>
          </Footer>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title="Redefinir senha" busy={resetting}>
        <Form>
          <FooterText>Enviaremos um link para você criar uma nova senha.</FooterText>
          {resetError && <InlineError message={resetError} />}
          <Input
            label="E-mail"
            value={resetEmail}
            onChangeText={(text) => {
              setResetEmail(text);
              setResetError(null);
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="seu@email.com"
            disabled={resetting}
          />
          <Button fullWidth loading={resetting} onPress={() => void handleReset()}>
            {resetting ? 'Enviando…' : 'Enviar link'}
          </Button>
        </Form>
      </Modal>
    </Safe>
  );
}

const Safe = styled(SafeAreaView)`
  flex: 1;
  background-color: ${color('bg')};
`;

const Brand = styled.View`
  align-items: center;
  margin-bottom: ${space(8)};
`;

const Logo = styled.View`
  width: 72px;
  height: 72px;
  border-radius: ${radius('xl')};
  align-items: center;
  justify-content: center;
  background-color: ${color('accentSoft')};
  border-width: 1px;
  border-color: ${color('accentBorder')};
  margin-bottom: ${space(4)};
`;

const AppName = styled.Text`
  color: ${color('text')};
  font-size: ${font('xxxl')};
  font-weight: 800;
`;

const Tagline = styled.Text`
  color: ${color('textMuted')};
  font-size: ${font('base')};
  margin-top: ${space(2)};
  text-align: center;
`;

const PasswordWrapper = styled.View`
  position: relative;
`;

/** Fica sobre o campo, alinhado à direita do controle (abaixo do rótulo). */
const EyeButton = styled.Pressable`
  position: absolute;
  right: ${space(3)};
  top: 40px;
`;

const LinkText = styled.Text`
  color: ${color('accent')};
  font-size: ${font('sm')};
  font-weight: 600;
`;

const Footer = styled.View`
  flex-direction: row;
  justify-content: center;
  align-items: center;
  gap: ${space(2)};
  margin-top: ${space(8)};
`;

const FooterText = styled.Text`
  color: ${color('textMuted')};
  font-size: ${font('sm')};
`;
