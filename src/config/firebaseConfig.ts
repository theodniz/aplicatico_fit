/**
 * Credenciais do projeto Firebase.
 *
 * Copie do console: Configurações do projeto → Seus apps → app Web
 * (ícone </>) → "Configuração do SDK" → opção "Config".
 *
 * Ficam em um arquivo e não em `.env` porque o Expo Snack não lê
 * variáveis de ambiente. Isso é seguro: a configuração web do
 * Firebase é feita para ser pública. Quem decide o que cada usuário
 * pode ler ou escrever são as regras em `firestore.rules`, não o
 * sigilo destas chaves.
 *
 * NUNCA coloque aqui uma chave de conta de serviço (service account /
 * Admin SDK). Ela ignora as regras de segurança por completo.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyDAOoOyde-BYKjNjbuAVXjHXIJcFDGx7jI',
  authDomain: 'academia-app-509de.firebaseapp.com',
  projectId: 'academia-app-509de',
  storageBucket: 'academia-app-509de.firebasestorage.app',
  messagingSenderId: '422068409638',
  appId: '1:422068409638:web:5bb3677ca18d17ebc19de7',
  measurementId: "G-6T9MLEVWT8"
};

/**
 * Falso enquanto as credenciais acima forem os valores de exemplo.
 * O App mostra uma tela explicando o que fazer, em vez de deixar o
 * login falhar com um erro técnico do SDK.
 */
export const isFirebaseConfigured = !firebaseConfig.apiKey.startsWith('COLE_AQUI');
