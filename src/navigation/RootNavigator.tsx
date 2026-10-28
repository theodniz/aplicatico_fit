import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from 'styled-components/native';
import { useAuth } from '../hooks/useAuth';
import { Loading } from '../components/ui/Feedback';
import type { RootStackParamList, TabParamList } from './types';

import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import HomeScreen from '../screens/HomeScreen';
import CyclesScreen from '../screens/CyclesScreen';
import AnalysisScreen from '../screens/AnalysisScreen';
import CycleFormScreen from '../screens/CycleFormScreen';
import WorkoutScreen from '../screens/WorkoutScreen';
import CycleEditorScreen from '../screens/CycleEditorScreen';
import CycleGeneratorScreen from '../screens/CycleGeneratorScreen';
import CycleSummaryScreen from '../screens/CycleSummaryScreen';
import SessionScreen from '../screens/SessionScreen';
import ExercisesScreen from '../screens/ExercisesScreen';
import ProgressScreen from '../screens/ProgressScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AdminUsersScreen from '../screens/admin/AdminUsersScreen';
import AdminUserEditorScreen from '../screens/admin/AdminUserEditorScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

/** Ícone da aba selecionada e da aba inativa. */
const TAB_ICONS: Record<keyof TabParamList, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  Home: ['home', 'home-outline'],
  Cycles: ['document-text', 'document-text-outline'],
  Analysis: ['stats-chart', 'stats-chart-outline'],
  Exercises: ['barbell', 'barbell-outline'],
  Profile: ['person', 'person-outline'],
};

function useHeaderOptions() {
  const theme = useTheme();
  return {
    headerStyle: { backgroundColor: theme.colors.bg },
    headerTintColor: theme.colors.text,
    headerTitleStyle: { fontWeight: '700' as const },
    headerShadowVisible: false,
  };
}

/**
 * Cinco destinos na barra inferior — o máximo antes de os alvos de
 * toque ficarem apertados em telas de 360px. A barra fica no rodapé
 * porque é onde o polegar alcança com uma mão só, justamente a
 * situação de uso na academia.
 */
function Tabs() {
  const theme = useTheme();
  const headerOptions = useHeaderOptions();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...headerOptions,
        sceneStyle: { backgroundColor: theme.colors.bg },
        tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textSubtle,
        tabBarIcon: ({ focused, color, size }) => (
          <Ionicons name={TAB_ICONS[route.name][focused ? 0 : 1]} color={color} size={size} />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Início' }} />
      <Tab.Screen name="Cycles" component={CyclesScreen} options={{ title: 'Minhas fichas', tabBarLabel: 'Fichas' }} />
      <Tab.Screen
        name="Analysis"
        component={AnalysisScreen}
        options={{ title: 'Análise do ciclo', tabBarLabel: 'Análise' }}
      />
      <Tab.Screen name="Exercises" component={ExercisesScreen} options={{ title: 'Exercícios' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Perfil' }} />
    </Tab.Navigator>
  );
}

/**
 * Árvore de navegação.
 *
 * Em vez de guardas de rota, o React Navigation troca o CONJUNTO de
 * telas conforme o estado de login: deslogado, só existem Login e
 * Cadastro; logado, só as telas do app. Ao entrar ou sair, a pilha é
 * substituída — não há "voltar" para a tela de login.
 *
 * Isto é navegação, não segurança: quem protege os dados são as
 * regras do Firestore (`firestore.rules`).
 */
export function RootNavigator() {
  const theme = useTheme();
  const headerOptions = useHeaderOptions();
  const { initializing, isAuthenticated, isAdmin } = useAuth();

  // Sem esta espera, o primeiro render (antes de o Firebase restaurar
  // a sessão do aparelho) mostraria o login a quem já está logado.
  if (initializing) return <Loading message="Carregando…" fullScreen />;

  return (
    <Stack.Navigator
      screenOptions={{
        ...headerOptions,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: theme.colors.bg },
      }}
    >
      {!isAuthenticated ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="SignUp" component={SignUpScreen} options={{ title: 'Criar conta' }} />
        </>
      ) : (
        <>
          <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
          <Stack.Screen
            name="CycleForm"
            component={CycleFormScreen}
            options={({ route }) => ({ title: route.params?.duplicateFrom ? 'Duplicar ficha' : 'Nova ficha' })}
          />
          <Stack.Screen name="Workout" component={WorkoutScreen} options={{ title: 'Ficha' }} />
          <Stack.Screen name="CycleEditor" component={CycleEditorScreen} options={{ title: 'Montar ficha' }} />
          <Stack.Screen name="CycleGenerator" component={CycleGeneratorScreen} options={{ title: 'Gerar divisão' }} />
          <Stack.Screen name="CycleSummary" component={CycleSummaryScreen} options={{ title: 'Acompanhamento' }} />
          {/* A execução do treino ocupa a tela inteira: sem cabeçalho
              nem gesto de voltar, para não convidar a sair no meio da
              série. A saída passa por uma confirmação. */}
          <Stack.Screen
            name="Session"
            component={SessionScreen}
            options={{ headerShown: false, gestureEnabled: false }}
          />
          <Stack.Screen name="Progress" component={ProgressScreen} options={{ title: 'Evolução' }} />

          {isAdmin && (
            <>
              <Stack.Screen name="AdminUsers" component={AdminUsersScreen} options={{ title: 'Usuários' }} />
              <Stack.Screen
                name="AdminUserEditor"
                component={AdminUserEditorScreen}
                options={({ route }) => ({ title: route.params?.userId ? 'Editar usuário' : 'Novo usuário' })}
              />
            </>
          )}
        </>
      )}
    </Stack.Navigator>
  );
}
