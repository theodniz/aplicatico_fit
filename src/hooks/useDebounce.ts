import { useEffect, useState } from 'react';

/**
 * Atrasa a propagação de um valor até ele parar de mudar.
 *
 * Usado na busca de exercícios: sem isso, digitar "supino" refiltraria
 * e redesenharia a lista seis vezes, uma por tecla. Com 300 ms, o
 * filtro roda uma vez só, quando o usuário faz a pausa natural.
 */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    // Cada tecla nova cancela o timer anterior; só o último sobrevive.
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
