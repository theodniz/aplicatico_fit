# Academia — Fichas de Treino (React Native)

Versão mobile do sistema de fichas de treino. Cada pessoa monta os próprios ciclos, executa o treino do dia no celular e acompanha a evolução de carga.

**Stack:** React Native · Expo SDK 54 (compatível com Expo Snack e com o Expo Go da App Store e da Play Store) · Firebase (Authentication + Cloud Firestore) · React Navigation 7 · styled-components · TanStack Query

```
App (Expo / Snack)
  ├── React Navigation   pilha de login · abas · telas do app
  ├── styled-components  tema escuro (src/theme)
  ├── TanStack Query     cache, estados de carregamento, invalidação
  └── services/          todo o acesso a dados
          ├── Firebase Auth   login, cadastro, redefinição de senha
          └── Firestore       dados, protegidos por firestore.rules
```

---

## 1. Criar e configurar o Firebase

1. Acesse https://console.firebase.google.com e clique em **Adicionar projeto**. O Google Analytics é opcional.
2. **Authentication → Começar → Sign-in method → E-mail/senha → Ativar.**
3. **Firestore Database → Criar banco de dados.** Escolha a região (`southamerica-east1`, São Paulo, para o Brasil) e comece em **modo de produção**.
4. **Firestore Database → Regras:** apague o conteúdo, cole o arquivo [`firestore.rules`](firestore.rules) inteiro e clique em **Publicar**.
   > Sem este passo, o login funciona, mas o app mostra "Você não tem permissão para realizar esta ação." — as regras padrão do modo de produção negam tudo.
5. **Configurações do projeto (engrenagem) → Seus apps → ícone Web `</>`** → registre um app (não precisa de Hosting) e copie o objeto `firebaseConfig`.
6. Cole os valores em [`src/config/firebaseConfig.ts`](src/config/firebaseConfig.ts).

A configuração web do Firebase **é pública por natureza** e pode ficar no código. Quem protege os dados são as regras do Firestore. Nunca coloque no app uma chave de *service account* (Admin SDK).

### Primeiro administrador

Todo cadastro feito pelo app nasce como `USER` (as regras recusam outro papel). Para criar o primeiro admin:

1. Crie sua conta pela tela **Criar conta** do app.
2. No console: **Firestore Database → Dados → `users` → (seu documento)** → edite o campo `role` de `USER` para `ADMIN`.
3. Saia e entre de novo no app. A opção **Perfil → Gerenciar usuários** aparece.

Daí em diante, outros admins são promovidos pela própria tela de usuários.

---

## 2. Rodar no Expo Snack

O Snack roda o projeto no navegador e no celular (pelo app Expo Go), sem instalar nada.

**Opção A — importar do GitHub (recomendado)**

1. Suba esta pasta para um repositório no GitHub.
2. Abra https://snack.expo.dev, clique no menu de projeto → **Import git repository** e cole a URL do repositório.
3. Confira, no rodapé do Snack, que o SDK selecionado é o **54**.
4. Edite `src/config/firebaseConfig.ts` no próprio Snack com as suas credenciais (se ainda não estiverem no repositório).
5. Rode na aba **Web**, ou escaneie o QR code com o **Expo Go** no celular.

**Opção B — arrastar os arquivos**

Crie um Snack novo (SDK 54), apague o `App.js` de exemplo e arraste para o editor `App.tsx`, `package.json` e a pasta `src/` inteira. O Snack instala as dependências listadas no `package.json`.

> **Por que o SDK 54?** O Expo Go da App Store parou no SDK 54: um projeto em SDK 55 ou superior não abre num iPhone físico pelo Expo Go (nem pelo Snack). O SDK 54 também é a versão mais nova oferecida pelo Snack. Não atualize o `expo` sem levar isso em conta.

O projeto foi escrito para funcionar no Snack: imports relativos (sem alias `@/`), credenciais em arquivo (o Snack não lê `.env`) e nenhuma dependência que exija módulo nativo fora do Expo Go.

---

## 3. Rodar localmente

```bash
npm install
npx expo start
```

Escaneie o QR code com o Expo Go (Android/iOS) ou pressione `w` para abrir no navegador.

| Comando | O que faz |
|---|---|
| `npx expo start` | Servidor de desenvolvimento |
| `npm test` | Testes unitários (Jest) |
| `npm run typecheck` | Verificação de tipos |
| `npx expo-doctor` | Diagnóstico de dependências |

---

## 4. Telas

| Tela | O que faz |
|---|---|
| **Login** | E-mail e senha, mostrar/ocultar senha, "Esqueci minha senha" (e-mail de redefinição) e link para o cadastro |
| **Criar conta** | Cadastro com nome, e-mail e senha; a conta nasce como `USER` |
| **Início** | Programação da semana (segunda a domingo) com a data, o treino de cada dia ou descanso; iniciar o treino de hoje, continuar o que está em andamento e ver a duração dos concluídos |
| **Fichas** | Ciclos agrupados em atual, próximos e histórico |
| **Nova ficha / Duplicar** | Período do ciclo e meta opcional; duplicar copia a divisão, não o histórico |
| **Ficha** | Dias colapsáveis, prescrições, vídeo, iniciar treino, encerrar/reabrir/excluir |
| **Montar ficha** | Dados do ciclo, dias (com os dias da semana de cada um) e exercícios com séries, repetições e carga, com reordenação ↑/↓ |
| **Gerar divisão** | Divisões prontas (A/B, PPL, ABCD, 5 dias), contagem por grupo, importação do catálogo básico |
| **Treino** | Tela cheia com cronômetro: exercícios com a carga definida na ficha, só para consulta; finalizar registra a duração |
| **Acompanhamento** | Progresso do período, meta, treinos concluídos, duração média e tempo total, evolução de carga e histórico do ciclo |
| **Análise** *(aba)* | O acompanhamento do ciclo ativo, sem precisar abrir a ficha |
| **Exercícios** | Catálogo pessoal com busca, filtro por grupo e link do YouTube |
| **Evolução** | Evolução de carga de todos os ciclos |
| **Perfil** | Nome, troca de senha (com senha atual), sair |
| **Usuários** *(admin)* | Listar, criar contas e definir papéis |

---

## 5. Arquitetura

```
App.tsx                  providers: tema, Query, Toast, Auth, Navigation
src/
├── config/              firebaseConfig (credenciais do projeto)
├── lib/                 firebase (app/auth/db), queryClient, errors
├── services/            ÚNICO acesso ao Firebase: auth, exercises,
│                        workouts, sessions, progress, generator, users
├── hooks/               TanStack Query sobre os services
├── contexts/            AuthContext, ToastContext
├── navigation/          RootNavigator (stack + abas) e tipos das rotas
├── screens/             uma tela por arquivo
├── components/
│   ├── ui/              Button, Field, Modal, ConfirmDialog, Feedback, Screen
│   └── domain/          Cycle (selo, barra, card), ExercisePicker, VideoPlayer
├── theme/               tokens do tema + tipagem do styled-components
├── constants/           grupos musculares, catálogo básico
├── types/               modelos de domínio
└── utils/               cycle, format, validation, youtube (+ testes)
firestore.rules          regras de segurança
```

### Modelo de dados no Firestore

```
users/{uid}                    nome, e-mail, papel (USER | ADMIN)
users/{uid}/exercises/{id}     catálogo pessoal
users/{uid}/workouts/{id}      ciclo + days[] + exercises[] (prescrições)
users/{uid}/sessions/{id}      treino de UM dia + executions[]
```

Dias e prescrições ficam **dentro** do documento da ficha: são sempre lidos juntos e precisam mudar juntos. Reordenar, gerar a divisão ou excluir um dia vira a escrita de um documento só, numa transação — nada fica pela metade se a conexão cair.

### Regras que eram do banco SQL

A versão web usava triggers e constraints do PostgreSQL. O Firestore não tem nada equivalente, então elas foram reimplementadas na camada `services/`:

| Regra | Onde está agora |
|---|---|
| Uma ficha ativa por vez (sem períodos sobrepostos) | `assertNoOverlap` em `services/workouts.ts` |
| Só treinar em ciclo ativo; um treino em andamento por vez | `startSession` em `services/sessions.ts` |
| Cada dia da semana pertence a um só dia da ficha | `assignWeekdays` em `services/workouts.ts` |
| A carga do treino é a da ficha, copiada ao iniciar (editar a ficha depois não muda o histórico) | `startSession` |
| Excluir exercício em uso é recusado | `deleteExercise` (consulta `exercise_ids`) |
| Excluir ficha/dia leva as sessões junto | `deleteWorkout` / `deleteWorkoutDay` |
| Ninguém se promove a admin | `firestore.rules` |
| Isolamento: cada um só vê os próprios dados, inclusive o admin | `firestore.rules` |

Essas checagens de negócio rodam no app; o **isolamento entre usuários e o controle de papéis** são garantidos pelo servidor, nas regras do Firestore.

### Criação de usuários pelo admin

Sem Cloud Functions (que exigem o plano pago), o admin cria contas por uma **instância secundária** do Firebase Auth (`getSecondaryAuth` em `lib/firebase.ts`): a conta nova é criada sem derrubar a sessão do admin, e o perfil é gravado com a sessão do admin, que as regras autorizam.

---

## 6. Solução de problemas

**A tela "Configure o Firebase" aparece**
`src/config/firebaseConfig.ts` ainda tem os valores de exemplo.

**"Você não tem permissão para realizar esta ação." logo após entrar**
As regras de `firestore.rules` não foram publicadas (passo 1.4).

**"O login por e-mail e senha não está habilitado no Firebase"**
Ative o provedor em Authentication → Sign-in method.

**"Já existe uma ficha ativa nesse período"**
Encerre o ciclo atual (**Ficha → Encerrar ciclo**) ou ajuste as datas do novo.

**"Este ciclo não está ativo"**
Só ciclos ativos aceitam treinos. Duplique a ficha para um período novo.

**"Gerar divisão" não adiciona nada**
O catálogo não tem exercícios dos grupos escolhidos. Use **Importar catálogo básico**.

**Não consigo excluir um exercício**
Ele está em alguma ficha ou no histórico de treinos. É intencional.

**A aba Usuários não aparece**
O campo `role` do seu documento em `users` não é `ADMIN`. Veja "Primeiro administrador" e entre de novo.
