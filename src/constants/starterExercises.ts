import type { MuscleGroup } from '../types/models';

/**
 * Catálogo básico de academia, importado pela opção "Importar
 * catálogo básico".
 *
 * Sem isto, "gerar ficha automaticamente" não teria de onde tirar
 * exercícios: a geração usa o catálogo do usuário, e um usuário novo
 * tem catálogo vazio. O gerador não INVENTA exercícios — ele escolhe
 * entre os que existem.
 *
 * Sem vídeo de propósito: seria pior semear IDs inventados e entregar
 * links quebrados.
 */
export const STARTER_EXERCISES: readonly {
  name: string;
  muscle_group: MuscleGroup;
  description: string;
}[] = [
  { name: 'Supino Reto com Barra', muscle_group: 'PEITO', description: 'Escápulas retraídas, descida controlada até o peito.' },
  { name: 'Supino Inclinado com Halteres', muscle_group: 'PEITO', description: 'Banco a 30-45°. Não deixe os halteres se chocarem no topo.' },
  { name: 'Crucifixo na Máquina', muscle_group: 'PEITO', description: 'Cotovelos levemente flexionados durante todo o movimento.' },
  { name: 'Crossover na Polia', muscle_group: 'PEITO', description: 'Leve inclinação de tronco, contração no fim do movimento.' },
  { name: 'Flexão de Braço', muscle_group: 'PEITO', description: 'Corpo alinhado, cotovelos a 45° do tronco.' },
  { name: 'Puxada Frontal', muscle_group: 'COSTAS', description: 'Puxe com os cotovelos, não com as mãos.' },
  { name: 'Remada Curvada', muscle_group: 'COSTAS', description: 'Coluna neutra, tronco a 45°.' },
  { name: 'Remada Baixa', muscle_group: 'COSTAS', description: 'Peito aberto, sem balançar o tronco.' },
  { name: 'Remada Unilateral com Halter', muscle_group: 'COSTAS', description: 'Apoie o joelho no banco, puxe rente ao tronco.' },
  { name: 'Barra Fixa', muscle_group: 'COSTAS', description: 'Pegada pronada. Use assistência se necessário.' },
  { name: 'Desenvolvimento com Halteres', muscle_group: 'OMBROS', description: 'Evite hiperextensão lombar. Core firme.' },
  { name: 'Elevação Lateral', muscle_group: 'OMBROS', description: 'Suba até a linha dos ombros, sem impulso de tronco.' },
  { name: 'Elevação Frontal', muscle_group: 'OMBROS', description: 'Controle a descida, sem balanço.' },
  { name: 'Crucifixo Inverso', muscle_group: 'OMBROS', description: 'Trabalha o deltoide posterior. Peso leve.' },
  { name: 'Desenvolvimento Militar', muscle_group: 'OMBROS', description: 'Barra à frente, glúteos e abdômen contraídos.' },
  { name: 'Rosca Direta', muscle_group: 'BICEPS', description: 'Sem balanço. Cotovelos fixos.' },
  { name: 'Rosca Martelo', muscle_group: 'BICEPS', description: 'Pegada neutra, trabalha braquiorradial.' },
  { name: 'Rosca Concentrada', muscle_group: 'BICEPS', description: 'Cotovelo apoiado na coxa, amplitude total.' },
  { name: 'Rosca Scott', muscle_group: 'BICEPS', description: 'Não estenda totalmente na descida.' },
  { name: 'Tríceps na Polia', muscle_group: 'TRICEPS', description: 'Cotovelos colados ao tronco. Extensão completa.' },
  { name: 'Tríceps Testa', muscle_group: 'TRICEPS', description: 'Movimento apenas do antebraço.' },
  { name: 'Tríceps Francês', muscle_group: 'TRICEPS', description: 'Halter acima da cabeça, cotovelos apontados para cima.' },
  { name: 'Mergulho no Banco', muscle_group: 'TRICEPS', description: 'Desça até 90° no cotovelo.' },
  { name: 'Agachamento Livre', muscle_group: 'QUADRICEPS', description: 'Joelhos alinhados aos pés. Desça até o paralelo.' },
  { name: 'Leg Press 45°', muscle_group: 'QUADRICEPS', description: 'Não trave os joelhos na extensão.' },
  { name: 'Cadeira Extensora', muscle_group: 'QUADRICEPS', description: 'Segure 1 segundo no topo.' },
  { name: 'Agachamento Búlgaro', muscle_group: 'QUADRICEPS', description: 'Pé traseiro elevado, tronco levemente inclinado.' },
  { name: 'Hack Machine', muscle_group: 'QUADRICEPS', description: 'Costas apoiadas, descida controlada.' },
  { name: 'Mesa Flexora', muscle_group: 'POSTERIOR', description: 'Quadril colado ao banco.' },
  { name: 'Stiff com Barra', muscle_group: 'POSTERIOR', description: 'Empurre o quadril para trás, barra rente às pernas.' },
  { name: 'Cadeira Flexora', muscle_group: 'POSTERIOR', description: 'Contração completa, descida lenta.' },
  { name: 'Elevação Pélvica', muscle_group: 'GLUTEOS', description: 'Barra sobre o quadril, contração no topo.' },
  { name: 'Cadeira Abdutora', muscle_group: 'GLUTEOS', description: 'Tronco levemente inclinado à frente.' },
  { name: 'Afundo', muscle_group: 'GLUTEOS', description: 'Passada longa, joelho traseiro próximo ao chão.' },
  { name: 'Panturrilha em Pé', muscle_group: 'PANTURRILHA', description: 'Amplitude completa, pausa embaixo.' },
  { name: 'Panturrilha Sentado', muscle_group: 'PANTURRILHA', description: 'Foco no sóleo. Movimento lento.' },
  { name: 'Prancha Abdominal', muscle_group: 'ABDOMEN', description: 'Corpo alinhado. Tempo em segundos no campo de repetições.' },
  { name: 'Abdominal Supra', muscle_group: 'ABDOMEN', description: 'Não puxe o pescoço com as mãos.' },
  { name: 'Elevação de Pernas', muscle_group: 'ABDOMEN', description: 'Lombar colada no chão ou no banco.' },
  { name: 'Encolhimento com Halteres', muscle_group: 'TRAPEZIO', description: 'Suba os ombros na vertical, sem rotação.' },
  { name: 'Rosca Punho', muscle_group: 'ANTEBRACO', description: 'Antebraços apoiados, amplitude curta e controlada.' },
  { name: 'Esteira', muscle_group: 'CARDIO', description: 'Repetições = minutos.' },
  { name: 'Bicicleta Ergométrica', muscle_group: 'CARDIO', description: 'Repetições = minutos.' },
];
