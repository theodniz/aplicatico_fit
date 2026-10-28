/**
 * Modelos de domínio.
 *
 * Estrutura no Firestore (tudo do usuário mora sob o documento dele,
 * o que torna o isolamento trivial de garantir nas regras):
 *
 *   users/{uid}                     perfil: nome, e-mail, papel
 *   users/{uid}/exercises/{id}      catálogo pessoal
 *   users/{uid}/workouts/{id}       ficha/ciclo, com os DIAS e as
 *                                   PRESCRIÇÕES embutidos
 *   users/{uid}/sessions/{id}       treino de UM dia, com as
 *                                   EXECUÇÕES embutidas
 *
 * Dias e prescrições ficam dentro do documento da ficha porque
 * sempre são lidos juntos e precisam mudar juntos: reordenar,
 * duplicar e gerar a divisão viram a escrita de um documento só,
 * atômica, em vez de dezenas de escritas soltas.
 *
 * Datas de calendário são strings 'YYYY-MM-DD' (sem fuso); instantes
 * são strings ISO 8601 em UTC, que ordenam lexicograficamente igual
 * à ordem cronológica.
 */
import type { CycleStatus } from '../utils/cycle';

export type UserRole = 'ADMIN' | 'USER';

export type SessionStatus = 'in_progress' | 'completed';

export type MuscleGroup =
  | 'PEITO'
  | 'COSTAS'
  | 'OMBROS'
  | 'BICEPS'
  | 'TRICEPS'
  | 'ANTEBRACO'
  | 'TRAPEZIO'
  | 'ABDOMEN'
  | 'QUADRICEPS'
  | 'POSTERIOR'
  | 'GLUTEOS'
  | 'PANTURRILHA'
  | 'CARDIO'
  | 'OUTRO';

export type { CycleStatus };

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Exercise {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  muscle_group: MuscleGroup;
  youtube_video_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Ficha (ciclo), sem a divisão. */
export interface Workout {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  /** 'YYYY-MM-DD' — data de calendário, sem fuso horário. */
  start_date: string;
  end_date: string;
  /** Encerramento manual. NULL não significa ativo. */
  completed_at: string | null;
  /** Meta de treinos do ciclo. NULL = sem meta definida. */
  session_goal: number | null;
  created_at: string;
  updated_at: string;
}

export interface WorkoutDayRow {
  id: string;
  workout_id: string;
  name: string;
  /** "Peito, Ombro e Tríceps". Opcional. */
  focus: string | null;
  day_order: number;
  /** Dias da semana em que este treino é feito: 0 = segunda … 6 = domingo. */
  weekdays: number[];
  created_at: string;
  updated_at: string;
}

/** Prescrição: séries, reps e carga de um exercício em um dia. */
export interface WorkoutExerciseRow {
  id: string;
  workout_day_id: string;
  exercise_id: string;
  sets: number;
  repetitions: string;
  /** Carga definida na montagem da ficha. É a usada no treino. */
  weight: number | null;
  rest_seconds: number | null;
  exercise_order: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Uma prescrição já unida ao exercício do catálogo. */
export interface WorkoutExercise extends WorkoutExerciseRow {
  exercise: Exercise;
}

/** Um dia da divisão, com os exercícios daquele dia. */
export interface WorkoutDay extends WorkoutDayRow {
  exercises: WorkoutExercise[];
}

/** Ficha completa: o ciclo com toda a divisão. */
export interface WorkoutWithDays extends Workout {
  days: WorkoutDay[];
}

/** Ficha na listagem: contagens em vez dos itens, e status do ciclo. */
export interface WorkoutSummary extends Workout {
  dayCount: number;
  exerciseCount: number;
  sessionCount: number;
  status: CycleStatus;
}

/** Recorte da prescrição guardado na execução, no momento do treino. */
export type PrescriptionSnapshot = Pick<
  WorkoutExerciseRow,
  'sets' | 'repetitions' | 'weight' | 'rest_seconds' | 'notes' | 'exercise_order'
>;

export interface ExerciseExecutionRow {
  id: string;
  exercise_id: string;
  workout_exercise_id: string | null;
  /** Marcado em bloco ao finalizar o treino. */
  completed: boolean;
  /** Carga do treino: cópia da prescrição no momento em que começou. */
  load: number | null;
  completed_at: string | null;
  prescription: PrescriptionSnapshot | null;
  /** Cópia do nome e do grupo, para o histórico sobreviver a edições. */
  exercise_name: string;
  muscle_group: MuscleGroup;
}

export interface WorkoutSession {
  id: string;
  user_id: string;
  /** O dia executado. Uma sessão é de UM dia, não da ficha. */
  workout_day_id: string;
  workout_id: string;
  started_at: string;
  completed_at: string | null;
  status: SessionStatus;
  created_at: string;
}

/** Execução unida ao exercício, para a tela de treino. */
export interface ExerciseExecution extends ExerciseExecutionRow {
  exercise: Exercise;
}

/** Sessão em andamento ou concluída, com os exercícios. */
export interface SessionWithExecutions extends WorkoutSession {
  /** O dia executado, e a ficha à qual ele pertence. */
  day: Pick<WorkoutDayRow, 'id' | 'name' | 'focus'> & {
    workout: Pick<Workout, 'id' | 'name'>;
  };
  executions: ExerciseExecution[];
}

/** Resumo de sessão para o histórico do ciclo. */
export interface SessionSummary extends WorkoutSession {
  dayName: string;
  completedCount: number;
  totalCount: number;
}

/** Treino da semana, com o que foi executado, para a home. */
export interface WeekSession extends SessionSummary {
  executions: ExerciseExecutionRow[];
}

// ---------------------------------------------------------------
// Acompanhamento
// ---------------------------------------------------------------

/** Indicadores do ciclo, todos derivados de sessões reais. */
export interface CycleStats {
  totalSessions: number;
  completedSessions: number;
  inProgressSessions: number;
  /** ISO da última sessão iniciada, ou null se nunca treinou. */
  lastSessionAt: string | null;
  /** Dia da última sessão. Base para sugerir o próximo. */
  lastSessionDayId: string | null;
  lastSessionDayName: string | null;
}

/** Evolução de carga de um exercício ao longo do tempo. */
export interface ExerciseProgress {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: MuscleGroup;
  /** Carga da primeira execução concluída com peso registrado. */
  firstLoad: number | null;
  /** Carga da execução concluída mais recente. */
  latestLoad: number | null;
  maxLoad: number | null;
  /** latestLoad - firstLoad. Null quando não há dois pontos. */
  delta: number | null;
  lastPerformedAt: string | null;
  sessionCount: number;
}

/** Um ponto do histórico de carga, para listas e gráficos futuros. */
export interface LoadHistoryPoint {
  date: string;
  load: number | null;
}

// ---------------------------------------------------------------
// Payloads de escrita
// ---------------------------------------------------------------

export interface WorkoutInput {
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  session_goal: number | null;
}

export interface ExerciseInput {
  name: string;
  description: string | null;
  muscle_group: MuscleGroup;
  youtube_video_id: string | null;
}

export interface WorkoutDayInput {
  name: string;
  focus: string | null;
  weekdays: number[];
}

export interface WorkoutExerciseInput {
  exercise_id: string;
  sets: number;
  repetitions: string;
  weight: number | null;
  rest_seconds: number | null;
  notes: string | null;
}

/** Um dia na especificação da geração automática. */
export interface PlanDaySpec {
  name: string;
  focus: string;
  groups: MuscleGroup[];
}

export interface GeneratePlanInput {
  workoutId: string;
  days: PlanDaySpec[];
  exercisesPerGroup: number;
}

export interface DuplicateWorkoutInput {
  sourceId: string;
  name: string;
  start_date: string;
  end_date: string;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}
