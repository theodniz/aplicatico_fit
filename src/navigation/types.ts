import { useNavigation } from '@react-navigation/native';
import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';

/**
 * Todas as rotas e seus parâmetros em um lugar só.
 *
 * Tipar os parâmetros faz o TypeScript acusar `navigate('Workout')`
 * sem `workoutId` — o equivalente às rotas centralizadas da versão
 * web, onde um erro de digitação só aparecia quando alguém clicava.
 */

/** Abas da barra inferior. */
export type TabParamList = {
  Home: undefined;
  Cycles: undefined;
  Analysis: undefined;
  Exercises: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  // ----- Público -----
  Login: undefined;
  SignUp: undefined;

  // ----- Autenticado -----
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  /** Criar ciclo, ou duplicar um existente com `duplicateFrom`. */
  CycleForm: { duplicateFrom?: string } | undefined;
  /** Consulta da ficha, usada durante o treino. */
  Workout: { workoutId: string };
  /** Montagem da ficha: dias, exercícios, prescrições e ordem. */
  CycleEditor: { workoutId: string };
  /** Geração automática da divisão. */
  CycleGenerator: { workoutId: string };
  /** Acompanhamento do ciclo: indicadores, histórico e evolução. */
  CycleSummary: { workoutId: string };
  /** Execução do treino. */
  Session: { sessionId: string };
  /** Evolução de carga de todos os exercícios. */
  Progress: undefined;

  // ----- Somente administradores -----
  AdminUsers: undefined;
  AdminUserEditor: { userId?: string } | undefined;
};

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

/**
 * Navegação tipada a partir de qualquer tela, inclusive as abas:
 * `navigate` sobe até o stack raiz quando a rota não está na aba.
 */
export function useAppNavigation() {
  return useNavigation<NativeStackNavigationProp<RootStackParamList>>();
}
