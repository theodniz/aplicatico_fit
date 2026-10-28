/**
 * Tradução de erros técnicos para mensagens que o usuário entende.
 *
 * Regra do projeto: a interface NUNCA mostra stack trace, caminho de
 * coleção ou mensagem crua do Firebase. Além de ser ruim de ler,
 * expor a estrutura do banco é entregar informação de graça para
 * quem estiver sondando o sistema.
 *
 * O erro original continua sendo logado no console para depuração.
 */

export type AppErrorKind =
  | 'auth'
  | 'permission'
  | 'not_found'
  | 'conflict'
  | 'in_use'
  | 'validation'
  | 'network'
  | 'unknown';

export class AppError extends Error {
  readonly kind: AppErrorKind;
  readonly cause: unknown;

  constructor(kind: AppErrorKind, message: string, cause?: unknown) {
    super(message);
    this.name = 'AppError';
    this.kind = kind;
    this.cause = cause;
  }
}

/** Formato dos erros lançados pelo SDK do Firebase. */
interface FirebaseLikeError {
  code?: string;
  message?: string;
}

function asFirebaseError(error: unknown): FirebaseLikeError {
  return typeof error === 'object' && error !== null ? (error as FirebaseLikeError) : {};
}

/** Erros do Firebase Auth, identificados pelo código `auth/...`. */
const AUTH_MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/invalid-login-credentials': 'E-mail ou senha incorretos.',
  'auth/wrong-password': 'E-mail ou senha incorretos.',
  'auth/user-not-found': 'E-mail ou senha incorretos.',
  'auth/invalid-email': 'E-mail inválido.',
  'auth/user-disabled': 'Esta conta foi desativada. Fale com o administrador.',
  'auth/too-many-requests': 'Muitas tentativas seguidas. Aguarde um minuto e tente novamente.',
  'auth/email-already-in-use': 'Já existe um usuário com este e-mail.',
  'auth/weak-password': 'A senha é curta demais. Use pelo menos 6 caracteres.',
  'auth/requires-recent-login': 'Por segurança, saia e entre novamente antes de continuar.',
  'auth/user-token-expired': 'Sua sessão expirou. Entre novamente.',
  'auth/operation-not-allowed':
    'O login por e-mail e senha não está habilitado no Firebase (Authentication → Sign-in method).',
  'auth/invalid-api-key': 'Configuração do Firebase inválida. Confira src/config/firebaseConfig.ts.',
  'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
    'Configuração do Firebase inválida. Confira src/config/firebaseConfig.ts.',
};

/**
 * Converte qualquer coisa lançada por uma chamada ao Firebase em um
 * AppError com mensagem apresentável.
 *
 * @param fallback  Mensagem quando não conseguimos identificar a causa.
 *                  Deve descrever a AÇÃO que falhou, ex.: "Não foi
 *                  possível salvar o exercício."
 */
export function toAppError(error: unknown, fallback: string): AppError {
  if (error instanceof AppError) return error;

  const firebaseError = asFirebaseError(error);
  const code = firebaseError.code ?? '';

  // Log técnico para o desenvolvedor; o usuário vê só a mensagem
  // amigável. Código e mensagem vão separados para ficarem legíveis
  // de imediato no console do Metro, sem expandir objeto.
  if (__DEV__) {
    console.error(`[firebase] ${code || 'sem código'}: ${firebaseError.message ?? 'sem mensagem'}`);
  }

  // Falha de rede: a requisição nem chegou ao servidor.
  if (
    code === 'auth/network-request-failed' ||
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    error instanceof TypeError
  ) {
    return new AppError(
      'network',
      'Sem conexão com o servidor. Verifique sua internet e tente novamente.',
      error,
    );
  }

  const authMessage = AUTH_MESSAGES[code];
  if (authMessage) return new AppError('auth', authMessage, error);

  switch (code) {
    // Bloqueado pelas regras de segurança do Firestore.
    case 'permission-denied':
      return new AppError('permission', 'Você não tem permissão para realizar esta ação.', error);

    case 'unauthenticated':
      return new AppError('auth', 'Sua sessão expirou. Entre novamente.', error);

    case 'not-found':
      return new AppError(
        'not_found',
        'Registro não encontrado ou indisponível para o seu usuário.',
        error,
      );

    // Transação que colidiu repetidas vezes com outra gravação.
    case 'aborted':
      return new AppError(
        'conflict',
        'Os dados mudaram enquanto você salvava. Tente novamente.',
        error,
      );

    // Firestore sem índice, sem banco criado ou cota estourada: é
    // problema de configuração, e a mensagem genérica serve melhor.
    case 'failed-precondition':
    case 'resource-exhausted':
      return new AppError('unknown', fallback, error);
  }

  return new AppError('unknown', fallback, error);
}

/** Mensagem segura para exibir, venha de onde vier o erro. */
export function getErrorMessage(error: unknown, fallback = 'Algo deu errado. Tente novamente.'): string {
  if (error instanceof AppError) return error.message;
  return toAppError(error, fallback).message;
}
