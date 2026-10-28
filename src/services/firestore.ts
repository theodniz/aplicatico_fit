/**
 * Utilitários compartilhados pelos serviços: caminhos das coleções,
 * id do usuário logado e escrita em lote.
 */
import { collection, doc, writeBatch } from 'firebase/firestore';
import type { DocumentReference } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { AppError } from '../lib/errors';

/**
 * Id do usuário logado.
 *
 * Todo dado mora sob `users/{uid}`, então o uid define ONDE ler e
 * gravar. As regras do Firestore exigem que ele seja o do próprio
 * token — passar o de outra pessoa faz o servidor recusar.
 */
export function requireUid(): string {
  const user = auth.currentUser;
  if (!user) throw new AppError('auth', 'Sua sessão expirou. Entre novamente.');
  return user.uid;
}

export const userRef = (uid: string) => doc(db, 'users', uid);
export const usersCol = () => collection(db, 'users');
export const exercisesCol = (uid: string) => collection(db, 'users', uid, 'exercises');
export const workoutsCol = (uid: string) => collection(db, 'users', uid, 'workouts');
export const sessionsCol = (uid: string) => collection(db, 'users', uid, 'sessions');

/** Instante atual em ISO 8601 (UTC). */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Id novo para itens embutidos (dias, prescrições, execuções).
 *
 * `doc(collection(...))` gera o id no próprio aparelho, sem ir ao
 * servidor — o mesmo gerador que o Firestore usa para documentos.
 */
export function newId(): string {
  return doc(collection(db, '_ids')).id;
}

/** Limite de operações por lote imposto pelo Firestore. */
const BATCH_LIMIT = 450;

/** Exclui muitos documentos respeitando o limite por lote. */
export async function deleteInBatches(refs: DocumentReference[]): Promise<void> {
  for (let start = 0; start < refs.length; start += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const ref of refs.slice(start, start + BATCH_LIMIT)) batch.delete(ref);
    await batch.commit();
  }
}

/**
 * Normaliza um nome para comparação: sem acento, sem caixa, sem
 * espaços nas pontas. "Supino reto" e "  SUPINO RETO" colidem.
 */
export function normalizeName(value: string): string {
  const trimmed = value.trim().toLowerCase();
  // `normalize` não existe em todo motor JS; sem ele, compara-se só
  // sem caixa — ainda pega o caso mais comum de duplicata.
  return typeof trimmed.normalize === 'function'
    ? trimmed.normalize('NFD').replace(/[̀-ͯ]/g, '')
    : trimmed;
}
