import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';

/**
 * Acesso ao estado de autenticação.
 *
 * Lança se usado fora do AuthProvider — assim o erro aparece na
 * hora, com nome do componente na stack, em vez de virar um
 * `null.profile` alguns renders depois.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth precisa ser usado dentro de <AuthProvider>.');
  }
  return context;
}
