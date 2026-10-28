import {
  validateExercise,
  validateLogin,
  validatePrescription,
  validateUser,
  validateWorkout,
} from './validation';

/**
 * As validações precisam ficar coladas às regras da camada de
 * serviço. Quando divergem, o usuário preenche um formulário que
 * parece válido e só descobre o problema quando o servidor recusa
 * a gravação — a pior forma de dar a notícia.
 */

const validExercise = {
  name: 'Supino Reto',
  muscle_group: 'PEITO',
  description: '',
  youtubeUrl: '',
};

describe('validateExercise', () => {
  it('aceita um exercício mínimo válido', () => {
    expect(validateExercise(validExercise)).toEqual({});
  });

  it('exige nome e grupo muscular', () => {
    const errors = validateExercise({ ...validExercise, name: '   ', muscle_group: '' });
    expect(errors.name).toBeDefined();
    expect(errors.muscle_group).toBeDefined();
  });

  it('exige pelo menos 2 caracteres no nome, como a constraint do banco', () => {
    expect(validateExercise({ ...validExercise, name: 'A' }).name).toBeDefined();
    expect(validateExercise({ ...validExercise, name: 'Ab' }).name).toBeUndefined();
  });

  it('trata o vídeo como opcional, mas valida quando preenchido', () => {
    expect(validateExercise({ ...validExercise, youtubeUrl: '' }).youtubeUrl).toBeUndefined();
    expect(
      validateExercise({
        ...validExercise,
        youtubeUrl: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
      }).youtubeUrl,
    ).toBeUndefined();
    expect(
      validateExercise({ ...validExercise, youtubeUrl: 'https://evil.com/video' }).youtubeUrl,
    ).toBeDefined();
  });
});

describe('validateWorkout', () => {
  const validCycle = {
    name: 'Hipertrofia — Ciclo 1',
    description: 'Treino focado em hipertrofia.',
    start_date: '2026-08-01',
    end_date: '2026-09-30',
    session_goal: '',
  };

  it('aceita um ciclo válido', () => {
    expect(validateWorkout(validCycle)).toEqual({});
  });

  it('exige nome', () => {
    expect(validateWorkout({ ...validCycle, name: '  ' }).name).toBeDefined();
  });

  it('limita a descrição a 500 caracteres, como a constraint', () => {
    expect(validateWorkout({ ...validCycle, description: 'x'.repeat(501) }).description).toBeDefined();
  });

  it('exige as duas datas do ciclo', () => {
    expect(validateWorkout({ ...validCycle, start_date: '' }).start_date).toBeDefined();
    expect(validateWorkout({ ...validCycle, end_date: '' }).end_date).toBeDefined();
  });

  it('rejeita término anterior ao início', () => {
    const errors = validateWorkout({
      ...validCycle,
      start_date: '2026-09-30',
      end_date: '2026-08-01',
    });
    expect(errors.end_date).toBe('A data de término deve ser posterior à data de início.');
  });

  it('aceita ciclo de um único dia', () => {
    // Início igual ao fim é um ciclo de 1 dia, não um erro — a
    // constraint do banco usa `end_date >= start_date`.
    expect(
      validateWorkout({ ...validCycle, start_date: '2026-08-01', end_date: '2026-08-01' })
        .end_date,
    ).toBeUndefined();
  });

  it('trata a meta de treinos como opcional', () => {
    expect(validateWorkout({ ...validCycle, session_goal: '' }).session_goal).toBeUndefined();
    expect(validateWorkout({ ...validCycle, session_goal: '24' }).session_goal).toBeUndefined();
  });

  it('rejeita meta inválida quando preenchida', () => {
    expect(validateWorkout({ ...validCycle, session_goal: '0' }).session_goal).toBeDefined();
    expect(validateWorkout({ ...validCycle, session_goal: '-3' }).session_goal).toBeDefined();
    expect(validateWorkout({ ...validCycle, session_goal: '2.5' }).session_goal).toBeDefined();
    expect(validateWorkout({ ...validCycle, session_goal: '501' }).session_goal).toBeDefined();
  });
});

const validPrescription = {
  exercise_id: 'e1b8f0c2-0000-4000-8000-000000000001',
  sets: '4',
  repetitions: '8-12',
  weight: '30',
  rest_seconds: '90',
  notes: '',
};

describe('validatePrescription', () => {
  it('aceita uma prescrição completa', () => {
    expect(validatePrescription(validPrescription)).toEqual({});
  });

  it('aceita repetições como número único ou faixa', () => {
    expect(validatePrescription({ ...validPrescription, repetitions: '10' })).toEqual({});
    expect(validatePrescription({ ...validPrescription, repetitions: '8-12' })).toEqual({});
  });

  it('rejeita repetições em formato livre, que a constraint recusaria', () => {
    for (const value of ['ate a falha', '8 a 12', '8–12', '', 'muitas']) {
      expect(validatePrescription({ ...validPrescription, repetitions: value }).repetitions).toBeDefined();
    }
  });

  it('rejeita faixa de repetições invertida', () => {
    expect(validatePrescription({ ...validPrescription, repetitions: '12-8' }).repetitions).toBeDefined();
  });

  it('exige séries inteiras entre 1 e 20', () => {
    expect(validatePrescription({ ...validPrescription, sets: '0' }).sets).toBeDefined();
    expect(validatePrescription({ ...validPrescription, sets: '21' }).sets).toBeDefined();
    expect(validatePrescription({ ...validPrescription, sets: '3.5' }).sets).toBeDefined();
    expect(validatePrescription({ ...validPrescription, sets: '' }).sets).toBeDefined();
    expect(validatePrescription({ ...validPrescription, sets: '1' }).sets).toBeUndefined();
  });

  it('trata carga vazia como peso corporal, e não como erro', () => {
    expect(validatePrescription({ ...validPrescription, weight: '' }).weight).toBeUndefined();
  });

  it('rejeita carga negativa ou não numérica', () => {
    expect(validatePrescription({ ...validPrescription, weight: '-5' }).weight).toBeDefined();
    expect(validatePrescription({ ...validPrescription, weight: 'pesado' }).weight).toBeDefined();
  });

  it('aceita vírgula decimal, como o teclado brasileiro produz', () => {
    expect(validatePrescription({ ...validPrescription, weight: '22,5' }).weight).toBeUndefined();
  });

  it('limita o descanso a 600 segundos, como a constraint', () => {
    expect(validatePrescription({ ...validPrescription, rest_seconds: '601' }).rest_seconds).toBeDefined();
    expect(validatePrescription({ ...validPrescription, rest_seconds: '-1' }).rest_seconds).toBeDefined();
    expect(validatePrescription({ ...validPrescription, rest_seconds: '600' }).rest_seconds).toBeUndefined();
  });

  it('exige que um exercício tenha sido escolhido', () => {
    expect(validatePrescription({ ...validPrescription, exercise_id: '' }).exercise_id).toBeDefined();
  });
});

describe('validateUser', () => {
  const validUser = {
    name: 'João da Silva',
    email: 'joao@email.com',
    password: 'senha123',
    role: 'USER',
  };

  it('aceita um usuário válido', () => {
    expect(validateUser(validUser, { requirePassword: true })).toEqual({});
  });

  it('exige senha apenas na criação', () => {
    const withoutPassword = { ...validUser, password: '' };
    expect(validateUser(withoutPassword, { requirePassword: true }).password).toBeDefined();
    expect(validateUser(withoutPassword, { requirePassword: false }).password).toBeUndefined();
  });

  it('exige o mínimo de 6 caracteres do Firebase Auth', () => {
    expect(validateUser({ ...validUser, password: '12345' }, { requirePassword: true }).password).toBeDefined();
    expect(validateUser({ ...validUser, password: '123456' }, { requirePassword: true }).password).toBeUndefined();
  });

  it('rejeita e-mails malformados', () => {
    for (const email of ['sem-arroba', 'a@b', '@dominio.com', 'com espaco@email.com', '']) {
      expect({ email, error: validateUser({ ...validUser, email }, { requirePassword: true }).email }).toEqual({
        email,
        error: expect.any(String),
      });
    }
  });

  it('aceita apenas os papéis existentes no enum do banco', () => {
    expect(validateUser({ ...validUser, role: 'ADMIN' }, { requirePassword: true }).role).toBeUndefined();
    expect(validateUser({ ...validUser, role: 'SUPERADMIN' }, { requirePassword: true }).role).toBeDefined();
    expect(validateUser({ ...validUser, role: '' }, { requirePassword: true }).role).toBeDefined();
  });
});

describe('validateLogin', () => {
  it('exige e-mail e senha', () => {
    expect(validateLogin({ email: 'a@b.com', password: 'x' })).toEqual({});
    expect(validateLogin({ email: '', password: 'x' }).email).toBeDefined();
    expect(validateLogin({ email: 'a@b.com', password: '' }).password).toBeDefined();
  });
});
