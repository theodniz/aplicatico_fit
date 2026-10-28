/**
 * Serviço de usuários (área administrativa).
 *
 * ESCOPO REDUZIDO no modelo de posse: o administrador gerencia
 * CONTAS — cria, lista, renomeia e define papéis. Ele NÃO tem
 * acesso a ficha, exercício, sessão ou histórico de ninguém; as
 * regras do Firestore tratam todo mundo igual nessas coleções.
 */
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { getSecondaryAuth } from '../lib/firebase';
import { AppError, toAppError } from '../lib/errors';
import type { CreateUserInput, Profile, UserRole } from '../types/models';
import { nowIso, userRef, usersCol } from './firestore';

export async function listUsers(): Promise<Profile[]> {
  try {
    const snapshot = await getDocs(usersCol());
    return snapshot.docs
      .map((item) => ({ ...(item.data() as Omit<Profile, 'id'>), id: item.id }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  } catch (error) {
    throw toAppError(error, 'Não foi possível carregar os usuários.');
  }
}

export async function getUser(userId: string): Promise<Profile> {
  try {
    const snapshot = await getDoc(userRef(userId));
    if (!snapshot.exists()) throw new AppError('not_found', 'Usuário não encontrado.');
    return { ...(snapshot.data() as Omit<Profile, 'id'>), id: snapshot.id };
  } catch (error) {
    throw toAppError(error, 'Não foi possível carregar o usuário.');
  }
}

/**
 * Atualiza nome e/ou papel.
 *
 * Se um usuário comum tentar mandar `role` daqui, as regras do
 * Firestore recusam a escrita. O app esconder o campo é
 * conveniência, não proteção.
 */
export async function updateUser(userId: string, input: { name: string; role: UserRole }): Promise<void> {
  try {
    await updateDoc(userRef(userId), {
      name: input.name.trim(),
      role: input.role,
      updated_at: nowIso(),
    });
  } catch (error) {
    throw toAppError(error, 'Não foi possível salvar o usuário.');
  }
}

/**
 * Cria um usuário com e-mail e senha inicial.
 *
 * A conta é criada numa instância secundária do Firebase Auth, para
 * não trocar a sessão do admin pela do usuário novo. O perfil é
 * gravado com a sessão do ADMIN: as regras só permitem criar perfil
 * de outra pessoa, e com papel definido, para quem é administrador.
 */
export async function createUser(input: CreateUserInput): Promise<{ id: string }> {
  const secondary = getSecondaryAuth();
  const email = input.email.trim().toLowerCase();

  try {
    const credential = await createUserWithEmailAndPassword(secondary, email, input.password);
    const now = nowIso();

    await setDoc(userRef(credential.user.uid), {
      name: input.name.trim(),
      email,
      role: input.role,
      created_at: now,
      updated_at: now,
    });

    return { id: credential.user.uid };
  } catch (error) {
    throw toAppError(error, 'Não foi possível criar o usuário.');
  } finally {
    await signOut(secondary).catch(() => undefined);
  }
}
