/**
 * Serviço de autenticação e perfil.
 *
 * Encapsula o Firebase Auth para que nenhum componente precise
 * conhecer a forma da resposta do SDK.
 */
import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updatePassword,
  updateProfile,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth } from '../lib/firebase';
import { AppError, toAppError } from '../lib/errors';
import type { Profile } from '../types/models';
import { nowIso, userRef } from './firestore';

export async function signIn(email: string, password: string): Promise<void> {
  try {
    await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
  } catch (error) {
    throw toAppError(error, 'Não foi possível entrar. Tente novamente.');
  }
}

/**
 * Cria a conta e o perfil.
 *
 * Toda conta nasce com papel USER. As regras do Firestore recusam um
 * perfil criado pelo próprio usuário com qualquer outro papel —
 * ninguém se cadastra como administrador.
 */
export async function signUp(name: string, email: string, password: string): Promise<void> {
  try {
    const credential = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    await updateProfile(credential.user, { displayName: name.trim() });
    await ensureProfile(credential.user, name.trim());
  } catch (error) {
    throw toAppError(error, 'Não foi possível criar sua conta.');
  }
}

/**
 * Envia o e-mail de redefinição de senha.
 *
 * O Firebase não revela se o e-mail existe (proteção contra
 * enumeração de contas), então a tela sempre mostra a mesma
 * confirmação.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email.trim().toLowerCase());
  } catch (error) {
    throw toAppError(error, 'Não foi possível enviar o e-mail de redefinição.');
  }
}

export async function signOut(): Promise<void> {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    throw toAppError(error, 'Não foi possível sair. Tente novamente.');
  }
}

/**
 * Busca o perfil (nome + papel) do usuário logado.
 *
 * O papel vem SEMPRE do Firestore, nunca de algo guardado no
 * aparelho. Mesmo que alguém adultere o app para liberar a área
 * administrativa, as regras do Firestore continuam barrando toda
 * operação de admin.
 */
export async function fetchProfile(userId: string): Promise<Profile | null> {
  try {
    const snapshot = await getDoc(userRef(userId));
    return snapshot.exists() ? ({ ...(snapshot.data() as Omit<Profile, 'id'>), id: snapshot.id }) : null;
  } catch (error) {
    throw toAppError(error, 'Não foi possível carregar seus dados.');
  }
}

/**
 * Garante que a conta tenha perfil, criando-o com papel USER.
 *
 * Cobre a conta criada direto no console do Firebase (Authentication
 * → Add user), que nasce sem documento em `users/` — o papel do
 * trigger `handle_new_user` da versão SQL.
 */
export async function ensureProfile(user: User, nameHint?: string): Promise<Profile> {
  const existing = await fetchProfile(user.uid);
  if (existing) return existing;

  const email = user.email ?? '';
  const now = nowIso();
  const profile: Omit<Profile, 'id'> = {
    name: nameHint || user.displayName || email.split('@')[0] || 'Atleta',
    email,
    role: 'USER',
    created_at: now,
    updated_at: now,
  };

  try {
    await setDoc(userRef(user.uid), profile);
    return { ...profile, id: user.uid };
  } catch (error) {
    throw toAppError(error, 'Não foi possível criar seu perfil.');
  }
}

export async function updateOwnName(userId: string, name: string): Promise<void> {
  try {
    await updateDoc(userRef(userId), { name: name.trim(), updated_at: nowIso() });
    if (auth.currentUser) await updateProfile(auth.currentUser, { displayName: name.trim() });
  } catch (error) {
    throw toAppError(error, 'Não foi possível salvar seu nome.');
  }
}

/**
 * Troca a senha.
 *
 * O Firebase exige login recente para operações sensíveis. Pedir a
 * senha atual e reautenticar evita o erro "requires-recent-login"
 * para quem está logado há dias — e confirma que é o dono do
 * aparelho, e não alguém que pegou o celular desbloqueado.
 */
export async function changeOwnPassword(currentPassword: string, newPassword: string): Promise<void> {
  const user = auth.currentUser;
  if (!user?.email) throw new AppError('auth', 'Sua sessão expirou. Entre novamente.');

  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
  } catch (error) {
    const converted = toAppError(error, 'Não foi possível confirmar sua senha atual.');
    // Aqui "credenciais inválidas" só pode ser a senha atual errada.
    throw converted.kind === 'auth' && converted.message.includes('incorretos')
      ? new AppError('auth', 'A senha atual está incorreta.', error)
      : converted;
  }

  try {
    await updatePassword(user, newPassword);
  } catch (error) {
    throw toAppError(error, 'Não foi possível alterar a senha.');
  }
}
