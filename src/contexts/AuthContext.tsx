import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { getErrorMessage } from '../lib/errors';
import { queryClient } from '../lib/queryClient';
import * as authService from '../services/auth';
import type { Profile } from '../types/models';

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  /** Por que o perfil não carregou, quando há sessão sem perfil. */
  profileError: string | null;
  /** true enquanto a sessão salva no aparelho ainda não foi resolvida. */
  initializing: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Fonte única de verdade sobre "quem está logado".
 *
 * Detalhe importante do fluxo: `initializing` começa em true e só
 * vira false depois que o Firebase termina de restaurar a sessão do
 * AsyncStorage E o perfil chega. Sem esse estado, o navegador veria
 * `user === null` no primeiro render e mostraria a tela de login por
 * um instante a cada abertura do app.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  // Nome digitado no cadastro. O onAuthStateChanged dispara assim que
  // a conta é criada — antes de o perfil ser gravado —, e sem isto o
  // perfil nasceria com o pedaço do e-mail no lugar do nome.
  const pendingName = useRef<string | undefined>(undefined);

  const loadProfile = useCallback(async (current: User) => {
    try {
      const loaded = await authService.ensureProfile(current, pendingName.current);
      setProfile(loaded);
      setProfileError(null);
    } catch (error) {
      // Sessão válida sem perfil acessível significa Firestore não
      // criado ou regras não publicadas. Tratamos como sem perfil em
      // vez de deixar o app num meio-termo, e a tela de login mostra
      // o motivo.
      setProfile(null);
      setProfileError(getErrorMessage(error, 'Não foi possível carregar seu perfil.'));
    }
  }, []);

  useEffect(() => {
    // Dispara com a sessão restaurada, e depois a cada login/logout.
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);

      if (!nextUser) {
        setProfile(null);
        setProfileError(null);
        // Dados de uma conta não podem vazar para a próxima que
        // entrar neste aparelho.
        queryClient.clear();
        setInitializing(false);
        return;
      }

      void loadProfile(nextUser).finally(() => setInitializing(false));
    });

    return unsubscribe;
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    await authService.signIn(email, password);
    // O onAuthStateChanged acima cuida de popular usuário e perfil.
  }, []);

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      pendingName.current = name.trim();
      try {
        await authService.signUp(name, email, password);
        if (auth.currentUser) await loadProfile(auth.currentUser);
      } finally {
        pendingName.current = undefined;
      }
    },
    [loadProfile],
  );

  const signOut = useCallback(async () => {
    await authService.signOut();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (auth.currentUser) await loadProfile(auth.currentUser);
  }, [loadProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      profileError,
      initializing,
      // Sem perfil, o app não tem como funcionar (nome, papel): só
      // conta como autenticado quem tem os dois.
      isAuthenticated: Boolean(user && profile),
      // O papel vem do Firestore, protegido pelas regras — nunca de
      // algo que o usuário consiga editar no aparelho.
      isAdmin: profile?.role === 'ADMIN',
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }),
    [user, profile, profileError, initializing, signIn, signUp, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
