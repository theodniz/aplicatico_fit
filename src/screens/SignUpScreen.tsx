import { useState } from 'react';
import { Pressable } from 'react-native';
import styled from 'styled-components/native';
import { useAuth } from '../hooks/useAuth';
import { Screen } from '../components/ui/Screen';
import { Form, Input } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { InlineError } from '../components/ui/Feedback';
import { getErrorMessage } from '../lib/errors';
import { validateSignUp } from '../utils/validation';
import type { FieldErrors, SignUpFormValues } from '../utils/validation';
import type { RootScreenProps } from '../navigation/types';
import { color, font, space } from '../theme/theme';

const EMPTY: SignUpFormValues = { name: '', email: '', password: '', passwordConfirm: '' };

/**
 * Cadastro público.
 *
 * A conta nasce como USER, e as regras do Firestore recusam qualquer
 * outro papel criado pelo próprio usuário. Para virar administrador,
 * outro admin promove a conta (ou, para o primeiro, pelo console do
 * Firebase — ver README).
 */
export default function SignUpScreen({ navigation }: RootScreenProps<'SignUp'>) {
  const { signUp } = useAuth();

  const [values, setValues] = useState<SignUpFormValues>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<SignUpFormValues>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (field: keyof SignUpFormValues) => (text: string) => {
    setValues((current) => ({ ...current, [field]: text }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  };

  async function handleSubmit() {
    const errors = validateSignUp(values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    setFormError(null);
    try {
      await signUp(values.name, values.email, values.password);
      // Logado: o RootNavigator troca para as telas do app.
    } catch (error) {
      setFormError(getErrorMessage(error, 'Não foi possível criar sua conta.'));
      setSubmitting(false);
    }
  }

  return (
    <Screen subtitle="Crie sua conta para montar e acompanhar suas fichas de treino.">
      <Form>
        {formError && <InlineError message={formError} />}

        <Input
          label="Nome"
          value={values.name}
          onChangeText={update('name')}
          error={fieldErrors.name}
          placeholder="João da Silva"
          autoComplete="name"
          textContentType="name"
          maxLength={80}
          disabled={submitting}
          required
        />
        <Input
          label="E-mail"
          value={values.email}
          onChangeText={update('email')}
          error={fieldErrors.email}
          placeholder="seu@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          disabled={submitting}
          required
        />
        <Input
          label="Senha"
          value={values.password}
          onChangeText={update('password')}
          error={fieldErrors.password}
          hint="Mínimo de 6 caracteres."
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          disabled={submitting}
          required
        />
        <Input
          label="Confirmar senha"
          value={values.passwordConfirm}
          onChangeText={update('passwordConfirm')}
          error={fieldErrors.passwordConfirm}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={() => void handleSubmit()}
          disabled={submitting}
          required
        />

        <Button size="lg" fullWidth loading={submitting} onPress={() => void handleSubmit()}>
          {submitting ? 'Criando conta…' : 'Criar conta'}
        </Button>
      </Form>

      <Footer>
        <FooterText>Já tem conta?</FooterText>
        <Pressable onPress={() => navigation.goBack()} accessibilityRole="link" hitSlop={8}>
          <LinkText>Entrar</LinkText>
        </Pressable>
      </Footer>
    </Screen>
  );
}

const Footer = styled.View`
  flex-direction: row;
  justify-content: center;
  gap: ${space(2)};
  margin-top: ${space(6)};
`;

const FooterText = styled.Text`
  color: ${color('textMuted')};
  font-size: ${font('sm')};
`;

const LinkText = styled.Text`
  color: ${color('accent')};
  font-size: ${font('sm')};
  font-weight: 600;
`;
