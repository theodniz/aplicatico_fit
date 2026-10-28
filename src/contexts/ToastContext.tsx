import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import styled, { useTheme } from 'styled-components/native';
import { color, font, radius, space } from '../theme/theme';

type ToastVariant = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showInfo: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 4000;

const ICONS = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  info: 'information-circle',
} as const;

/**
 * Notificações efêmeras de sucesso e erro.
 *
 * Implementado à mão em vez de trazer uma biblioteca: são poucas
 * linhas e funciona igual no Android, no iOS e no Snack web.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (message: string, variant: ToastVariant) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, message, variant }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), AUTO_DISMISS_MS),
      );
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      showSuccess: (message) => show(message, 'success'),
      showError: (message) => show(message, 'error'),
      showInfo: (message) => show(message, 'info'),
    }),
    [show],
  );

  const tint = { success: theme.colors.accent, error: theme.colors.danger, info: theme.colors.info };

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* `box-none`: a área vazia entre os avisos não rouba o toque
          da tela que está por baixo. */}
      <Viewport pointerEvents="box-none" style={{ top: insets.top + 8 }}>
        {toasts.map((toast) => (
          <ToastCard
            key={toast.id}
            $variant={toast.variant}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            <Ionicons name={ICONS[toast.variant]} size={20} color={tint[toast.variant]} />
            <ToastMessage>{toast.message}</ToastMessage>
            <Pressable
              onPress={() => dismiss(toast.id)}
              accessibilityLabel="Fechar aviso"
              hitSlop={12}
            >
              <Ionicons name="close" size={18} color={theme.colors.textMuted} />
            </Pressable>
          </ToastCard>
        ))}
      </Viewport>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast precisa ser usado dentro de <ToastProvider>.');
  }
  return context;
}

const Viewport = styled.View`
  position: absolute;
  left: ${space(4)};
  right: ${space(4)};
  gap: ${space(2)};
  z-index: 1000;
  elevation: 1000;
`;

const ToastCard = styled.View<{ $variant: ToastVariant }>`
  flex-direction: row;
  align-items: center;
  gap: ${space(3)};
  padding: ${space(3)} ${space(4)};
  border-radius: ${radius('md')};
  border-width: 1px;
  background-color: ${color('surfaceRaised')};
  border-color: ${({ theme, $variant }) =>
    $variant === 'success'
      ? theme.colors.accentBorder
      : $variant === 'error'
        ? theme.colors.dangerBorder
        : theme.colors.borderStrong};
`;

const ToastMessage = styled.Text`
  flex: 1;
  color: ${color('text')};
  font-size: ${font('sm')};
  line-height: 20px;
`;
