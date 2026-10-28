import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import { getAuth, initializeAuth, inMemoryPersistence } from 'firebase/auth';
import type { Auth, Persistence } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { firebaseConfig } from '../config/firebaseConfig';

/**
 * Cliente Firebase — ponto ÚNICO de contato com o backend.
 *
 * Nenhum componente importa este arquivo diretamente: a UI fala com
 * `services/`, que fala com o Firestore. Isso mantém as consultas em
 * um lugar só (foi o que permitiu trocar o Supabase pelo Firebase
 * sem reescrever as telas).
 */

export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

/**
 * `getReactNativePersistence` só existe no build React Native do
 * SDK, e os tipos públicos de `firebase/auth` são os do build web.
 * Ler pelo namespace evita o erro de tipo e devolve `undefined` no
 * navegador (Snack web), onde a persistência padrão já é a correta.
 */
type RNPersistenceFactory = (storage: typeof AsyncStorage) => Persistence;
const getReactNativePersistence = (FirebaseAuth as unknown as {
  getReactNativePersistence?: RNPersistenceFactory;
}).getReactNativePersistence;

function createAuth(): Auth {
  if (Platform.OS === 'web' || !getReactNativePersistence) return getAuth(app);

  try {
    // Sessão salva no AsyncStorage: o usuário continua logado depois
    // de fechar o app — o equivalente ao "a sessão persiste" da web.
    return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    // Fast Refresh reexecuta o módulo, e initializeAuth só pode rodar
    // uma vez por app. Na segunda vez, reaproveitamos a instância.
    return getAuth(app);
  }
}

export const auth: Auth = createAuth();

function createFirestore(): Firestore {
  try {
    // Long polling forçado no celular: o canal de streaming padrão do
    // SDK web falha em parte dos aparelhos/redes com React Native e
    // aparece como "Could not reach Cloud Firestore backend".
    return initializeFirestore(app, { experimentalForceLongPolling: Platform.OS !== 'web' });
  } catch {
    return getFirestore(app);
  }
}

export const db: Firestore = createFirestore();

let secondaryAuth: Auth | null = null;

/**
 * Instância de Auth separada, usada só pelo admin para criar contas.
 *
 * `createUserWithEmailAndPassword` faz login automático na conta
 * criada. Na instância principal isso derrubaria a sessão do admin;
 * numa instância secundária, em memória, a sessão dele fica intacta.
 * É a forma de cadastrar usuários sem Cloud Functions (que exigem o
 * plano pago do Firebase).
 */
export function getSecondaryAuth(): Auth {
  if (secondaryAuth) return secondaryAuth;

  const name = 'admin-secondary';
  const secondary = getApps().find((item) => item.name === name) ?? initializeApp(firebaseConfig, name);

  try {
    secondaryAuth = initializeAuth(secondary, { persistence: inMemoryPersistence });
  } catch {
    secondaryAuth = getAuth(secondary);
  }
  return secondaryAuth;
}
