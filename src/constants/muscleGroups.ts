import type { MuscleGroup } from '../types/models';

/**
 * Rótulos dos grupos musculares.
 *
 * O Firestore guarda o código sem acento e em maiúsculas (PEITO,
 * POSTERIOR...), o que mantém a grafia única e torna a comparação
 * trivial. A tradução para o texto que o usuário lê fica aqui, em
 * um lugar só.
 *
 * `satisfies` garante, em tempo de compilação, que todo valor do
 * enum tenha rótulo — adicionar um grupo em `MuscleGroup` sem atualizar
 * este arquivo vira erro de build, e não um "undefined" na tela.
 */
export const MUSCLE_GROUP_LABELS = {
  PEITO: 'Peito',
  COSTAS: 'Costas',
  OMBROS: 'Ombros',
  BICEPS: 'Bíceps',
  TRICEPS: 'Tríceps',
  ANTEBRACO: 'Antebraço',
  TRAPEZIO: 'Trapézio',
  ABDOMEN: 'Abdômen',
  QUADRICEPS: 'Quadríceps',
  POSTERIOR: 'Posterior de coxa',
  GLUTEOS: 'Glúteos',
  PANTURRILHA: 'Panturrilha',
  CARDIO: 'Cardio',
  OUTRO: 'Outro',
} as const satisfies Record<MuscleGroup, string>;

/** Ordem de exibição: agrupada por região, não alfabética. */
export const MUSCLE_GROUPS = [
  'PEITO',
  'COSTAS',
  'OMBROS',
  'BICEPS',
  'TRICEPS',
  'ANTEBRACO',
  'TRAPEZIO',
  'ABDOMEN',
  'QUADRICEPS',
  'POSTERIOR',
  'GLUTEOS',
  'PANTURRILHA',
  'CARDIO',
  'OUTRO',
] as const satisfies readonly MuscleGroup[];

export const MUSCLE_GROUP_OPTIONS = MUSCLE_GROUPS.map((value) => ({
  value,
  label: MUSCLE_GROUP_LABELS[value],
}));

export function muscleGroupLabel(group: MuscleGroup): string {
  return MUSCLE_GROUP_LABELS[group] ?? 'Outro';
}
