import { Platform } from 'react-native';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import styled, { ThemeProvider } from 'styled-components/native';

import { isFirebaseConfigured } from './src/config/firebaseConfig';
import { theme, color, font, space } from './src/theme/theme';

// Na web, a página sai sem idioma declarado e o Chrome a toma por
// inglês: o tradutor automático "traduz" o português para português
// e estraga o texto ("Início" → "Não se trata de uma questão de…",
// "Treino" → "Trem"). Declarar pt-BR e desligar a tradução resolve.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.documentElement.lang = 'pt-BR';
  document.documentElement.setAttribute('translate', 'no');
}

/** Tema do React Navigation alinhado aos tokens do app. */
const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: theme.colors.accent,
    background: theme.colors.bg,
    card: theme.colors.surface,
    text: theme.colors.text,
    border: theme.colors.border,
  },
};

/**
 * Ponto de entrada.
 *
 * Ordem dos providers importa: o tema vem antes de tudo (até a tela de
 * configuração usa styled-components), o QueryClient antes da
 * autenticação (que limpa o cache no logout), e o Toast por fora da
 * navegação para os avisos sobreviverem à troca de tela.
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider theme={theme}>
        <StatusBar style="light" />
        {isFirebaseConfigured ? <ConfiguredApp /> : <MissingConfig />}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/**
 * O app de verdade. Importado sob demanda para que, sem credenciais,
 * o SDK do Firebase nem seja inicializado.
 */
function ConfiguredApp() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { queryClient } = require('./src/lib/queryClient') as typeof import('./src/lib/queryClient');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { AuthProvider } = require('./src/contexts/AuthContext') as typeof import('./src/contexts/AuthContext');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ToastProvider } = require('./src/contexts/ToastContext') as typeof import('./src/contexts/ToastContext');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { RootNavigator } = require('./src/navigation/RootNavigator') as typeof import('./src/navigation/RootNavigator');

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <NavigationContainer theme={navigationTheme}>
            <RootNavigator />
          </NavigationContainer>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

/**
 * Falhar aqui, na abertura, com instrução clara é muito melhor do que
 * deixar o login quebrar com "auth/invalid-api-key".
 */
function MissingConfig() {
  return (
    <Centered>
      <Title>Configure o Firebase</Title>
      <Body>
        Abra <Code>src/config/firebaseConfig.ts</Code> e cole as credenciais do seu projeto (Console do Firebase →
        Configurações do projeto → Seus apps → app Web).
      </Body>
      <Body>O passo a passo completo está no README.md.</Body>
    </Centered>
  );
}

const Centered = styled.View`
  flex: 1;
  justify-content: center;
  gap: ${space(4)};
  padding: ${space(6)};
  background-color: ${color('bg')};
`;

const Title = styled.Text`
  color: ${color('text')};
  font-size: ${font('xxl')};
  font-weight: 800;
`;

const Body = styled.Text`
  color: ${color('textMuted')};
  font-size: ${font('base')};
  line-height: 24px;
`;

const Code = styled.Text`
  color: ${color('accent')};
  font-family: monospace;
`;
