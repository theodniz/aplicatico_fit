import { useEffect, useState } from 'react';

/**
 * Relógio que re-renderiza a cada `intervalMs`, para cronômetros.
 *
 * O tempo exibido é sempre calculado a partir de `started_at`, nunca
 * acumulado aqui: sair do app, bloquear a tela ou trocar de aparelho
 * não faz o cronômetro atrasar.
 */
export function useNow(intervalMs = 1000, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);

  return now;
}
