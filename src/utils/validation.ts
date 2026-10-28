/**
 * Validação de formulários.
 *
 * Espelha de propósito as regras da camada de serviço e do
 * `firestore.rules`. A validação na tela existe para dar feedback
 * imediato e bom — NÃO é a proteção do sistema. Quem garante o
 * isolamento dos dados são as regras de segurança do Firestore, que
 * continuam valendo mesmo se alguém chamar a API na mão.
 */
import { extractVideoId } from './youtube';

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

export function hasErrors<T>(errors: FieldErrors<T>): boolean {
  return Object.keys(errors).length > 0;
}

/** Aceita "10" ou "8-12" — mesmo formato exigido pela ficha. */
const REPETITIONS_PATTERN = /^\d{1,3}(-\d{1,3})?$/;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ---------------------------------------------------------------
// Exercício (catálogo)
// ---------------------------------------------------------------

export interface ExerciseFormValues {
  name: string;
  muscle_group: string;
  description: string;
  youtubeUrl: string;
}

export function validateExercise(values: ExerciseFormValues): FieldErrors<ExerciseFormValues> {
  const errors: FieldErrors<ExerciseFormValues> = {};

  const name = values.name.trim();
  if (!name) {
    errors.name = 'Informe o nome do exercício.';
  } else if (name.length < 2) {
    errors.name = 'O nome precisa ter pelo menos 2 caracteres.';
  } else if (name.length > 100) {
    errors.name = 'O nome pode ter no máximo 100 caracteres.';
  }

  if (!values.muscle_group) {
    errors.muscle_group = 'Selecione o grupo muscular.';
  }

  if (values.description.length > 1000) {
    errors.description = 'A descrição pode ter no máximo 1000 caracteres.';
  }

  // Vídeo é opcional; se preenchido, precisa ser reconhecível.
  const youtubeUrl = values.youtubeUrl.trim();
  if (youtubeUrl && !extractVideoId(youtubeUrl)) {
    errors.youtubeUrl =
      'Link do YouTube inválido. Use um endereço como https://youtube.com/watch?v=...';
  }

  return errors;
}

// ---------------------------------------------------------------
// Ficha de treino
// ---------------------------------------------------------------

export interface WorkoutFormValues {
  name: string;
  description: string;
  /** 'YYYY-MM-DD', vindo do campo de data (DD/MM/AAAA na tela). */
  start_date: string;
  end_date: string;
  /** Meta de treinos do ciclo. Vazio = sem meta. */
  session_goal: string;
}

export function validateWorkout(values: WorkoutFormValues): FieldErrors<WorkoutFormValues> {
  const errors: FieldErrors<WorkoutFormValues> = {};

  const name = values.name.trim();
  if (!name) {
    errors.name = 'Informe o nome do treino.';
  } else if (name.length > 100) {
    errors.name = 'O nome pode ter no máximo 100 caracteres.';
  }

  if (values.description.length > 500) {
    errors.description = 'A descrição pode ter no máximo 500 caracteres.';
  }

  if (!values.start_date) {
    errors.start_date = 'Informe a data de início.';
  }

  if (!values.end_date) {
    errors.end_date = 'Informe a data de término.';
  }

  // Comparação direta de strings 'YYYY-MM-DD' funciona e é
  // ordenada lexicograficamente igual à ordem cronológica — sem
  // Date, sem fuso horário, sem surpresa na virada do dia.
  if (values.start_date && values.end_date && values.end_date < values.start_date) {
    errors.end_date = 'A data de término deve ser posterior à data de início.';
  }

  // Meta é opcional (§40): sem ela, a interface mostra o número
  // absoluto de treinos e nenhum percentual.
  if (values.session_goal.trim()) {
    const goal = Number(values.session_goal);
    if (!Number.isInteger(goal) || goal < 1) {
      errors.session_goal = 'A meta precisa ser um número inteiro maior que zero.';
    } else if (goal > 500) {
      errors.session_goal = 'Meta acima do limite permitido.';
    }
  }

  return errors;
}

// ---------------------------------------------------------------
// Prescrição (exercício dentro de uma ficha)
// ---------------------------------------------------------------

export interface PrescriptionFormValues {
  exercise_id: string;
  sets: string;
  repetitions: string;
  weight: string;
  rest_seconds: string;
  notes: string;
}

export function validatePrescription(
  values: PrescriptionFormValues,
): FieldErrors<PrescriptionFormValues> {
  const errors: FieldErrors<PrescriptionFormValues> = {};

  if (!values.exercise_id) {
    errors.exercise_id = 'Selecione o exercício.';
  }

  const sets = Number(values.sets);
  if (!values.sets.trim()) {
    errors.sets = 'Informe o número de séries.';
  } else if (!Number.isInteger(sets) || sets < 1 || sets > 20) {
    errors.sets = 'Séries deve ser um número inteiro entre 1 e 20.';
  }

  const repetitions = values.repetitions.trim();
  if (!repetitions) {
    errors.repetitions = 'Informe as repetições.';
  } else if (!REPETITIONS_PATTERN.test(repetitions)) {
    errors.repetitions = 'Use um número (10) ou uma faixa (8-12).';
  } else {
    const [min, max] = repetitions.split('-').map(Number);
    if (max !== undefined && min !== undefined && max < min) {
      errors.repetitions = 'A faixa está invertida. Use, por exemplo, 8-12.';
    }
  }

  // Carga vazia é válida: significa peso corporal.
  if (values.weight.trim()) {
    const weight = Number(values.weight.replace(',', '.'));
    if (Number.isNaN(weight)) {
      errors.weight = 'A carga precisa ser um número.';
    } else if (weight < 0) {
      errors.weight = 'A carga não pode ser negativa.';
    } else if (weight > 9999) {
      errors.weight = 'Carga acima do limite permitido.';
    }
  }

  if (values.rest_seconds.trim()) {
    const rest = Number(values.rest_seconds);
    if (!Number.isInteger(rest)) {
      errors.rest_seconds = 'O descanso precisa ser um número inteiro de segundos.';
    } else if (rest < 0 || rest > 600) {
      errors.rest_seconds = 'O descanso deve ficar entre 0 e 600 segundos.';
    }
  }

  if (values.notes.length > 500) {
    errors.notes = 'As observações podem ter no máximo 500 caracteres.';
  }

  return errors;
}

// ---------------------------------------------------------------
// Usuário
// ---------------------------------------------------------------

export interface UserFormValues {
  name: string;
  email: string;
  password: string;
  role: string;
}

export function validateUser(
  values: UserFormValues,
  options: { requirePassword: boolean },
): FieldErrors<UserFormValues> {
  const errors: FieldErrors<UserFormValues> = {};

  const name = values.name.trim();
  if (!name) {
    errors.name = 'Informe o nome.';
  } else if (name.length < 2) {
    errors.name = 'O nome precisa ter pelo menos 2 caracteres.';
  } else if (name.length > 80) {
    errors.name = 'O nome pode ter no máximo 80 caracteres.';
  }

  const email = values.email.trim();
  if (!email) {
    errors.email = 'Informe o e-mail.';
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = 'E-mail inválido.';
  }

  if (options.requirePassword) {
    if (!values.password) {
      errors.password = 'Defina uma senha inicial.';
    } else if (values.password.length < 6) {
      // Mesmo mínimo exigido pelo Firebase Auth.
      errors.password = 'A senha precisa ter pelo menos 6 caracteres.';
    }
  }

  if (values.role !== 'ADMIN' && values.role !== 'USER') {
    errors.role = 'Selecione o perfil de acesso.';
  }

  return errors;
}

// ---------------------------------------------------------------
// Login
// ---------------------------------------------------------------

export interface LoginFormValues {
  email: string;
  password: string;
}

export function validateLogin(values: LoginFormValues): FieldErrors<LoginFormValues> {
  const errors: FieldErrors<LoginFormValues> = {};

  if (!values.email.trim()) {
    errors.email = 'Informe seu e-mail.';
  } else if (!EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = 'E-mail inválido.';
  }

  if (!values.password) {
    errors.password = 'Informe sua senha.';
  }

  return errors;
}

// ---------------------------------------------------------------
// Cadastro
// ---------------------------------------------------------------

export interface SignUpFormValues {
  name: string;
  email: string;
  password: string;
  passwordConfirm: string;
}

export function validateSignUp(values: SignUpFormValues): FieldErrors<SignUpFormValues> {
  const errors: FieldErrors<SignUpFormValues> = {};

  const name = values.name.trim();
  if (!name) {
    errors.name = 'Informe seu nome.';
  } else if (name.length < 2) {
    errors.name = 'O nome precisa ter pelo menos 2 caracteres.';
  } else if (name.length > 80) {
    errors.name = 'O nome pode ter no máximo 80 caracteres.';
  }

  if (!values.email.trim()) {
    errors.email = 'Informe seu e-mail.';
  } else if (!EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = 'E-mail inválido.';
  }

  if (!values.password) {
    errors.password = 'Defina uma senha.';
  } else if (values.password.length < 6) {
    errors.password = 'A senha precisa ter pelo menos 6 caracteres.';
  }

  if (values.passwordConfirm !== values.password) {
    errors.passwordConfirm = 'As senhas não conferem.';
  }

  return errors;
}

/** Só o e-mail, para "Esqueci minha senha". */
export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Informe seu e-mail.';
  if (!EMAIL_PATTERN.test(email.trim())) return 'E-mail inválido.';
  return null;
}
