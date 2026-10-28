import type { ReactNode } from 'react';
import { ActivityIndicator } from 'react-native';
import type { PressableProps } from 'react-native';
import styled, { css, useTheme } from 'styled-components/native';
import type { DefaultTheme } from 'styled-components/native';
import { radius, space } from '../../theme/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerOutline';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  /** Mostra spinner e bloqueia toques durante a operação. */
  loading?: boolean;
  /** Ícone à esquerda do texto. */
  icon?: ReactNode;
  children: ReactNode;
}

/** Cor do texto (e do spinner) por variante. */
function foreground(theme: DefaultTheme, variant: Variant): string {
  switch (variant) {
    case 'primary':
      return theme.colors.textOnAccent;
    case 'danger':
      return '#ffffff';
    case 'dangerOutline':
      return theme.colors.danger;
    case 'ghost':
      return theme.colors.accent;
    default:
      return theme.colors.text;
  }
}

/**
 * Botão da aplicação.
 *
 * `loading` desabilita o botão de verdade, e não apenas visualmente.
 * É o que impede toques repetidos durante uma operação — sem isso,
 * um toque duplo em "Salvar" numa rede lenta cria dois registros.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled,
  icon,
  children,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = Boolean(disabled || loading);
  const textColor = foreground(theme, variant);

  return (
    <Base
      $variant={variant}
      $size={size}
      $fullWidth={fullWidth}
      $disabled={isDisabled}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      {...rest}
    >
      {({ pressed }) => (
        <>
          {/* Camada de "pressionado": Pressable não tem :active. */}
          {pressed && <PressedOverlay />}
          {loading ? <ActivityIndicator size="small" color={textColor} /> : icon}
          {typeof children === 'string' ? (
            <Label $size={size} style={{ color: textColor }} numberOfLines={2}>
              {children}
            </Label>
          ) : (
            children
          )}
        </>
      )}
    </Base>
  );
}

const variantStyles = {
  primary: css`
    background-color: ${({ theme }) => theme.colors.accent};
    border-color: ${({ theme }) => theme.colors.accent};
  `,
  secondary: css`
    background-color: ${({ theme }) => theme.colors.surfaceRaised};
    border-color: ${({ theme }) => theme.colors.borderStrong};
  `,
  ghost: css`
    background-color: transparent;
    border-color: transparent;
  `,
  danger: css`
    background-color: ${({ theme }) => theme.colors.danger};
    border-color: ${({ theme }) => theme.colors.danger};
  `,
  dangerOutline: css`
    background-color: transparent;
    border-color: ${({ theme }) => theme.colors.dangerBorder};
  `,
};

const sizeStyles = {
  sm: css`
    min-height: 36px;
    padding: ${space(2)} ${space(3)};
  `,
  // 48px: alvo de toque confortável mesmo com a mão suada.
  md: css`
    min-height: 48px;
    padding: ${space(3)} ${space(4)};
  `,
  lg: css`
    min-height: 56px;
    padding: ${space(4)} ${space(5)};
  `,
};

const Base = styled.Pressable<{
  $variant: Variant;
  $size: Size;
  $fullWidth: boolean;
  $disabled: boolean;
}>`
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: ${space(2)};
  border-width: 1px;
  border-radius: ${radius('md')};
  overflow: hidden;
  ${({ $variant }) => variantStyles[$variant]}
  ${({ $size }) => sizeStyles[$size]}
  ${({ $fullWidth }) => ($fullWidth ? 'align-self: stretch;' : 'align-self: flex-start;')}
  opacity: ${({ $disabled }) => ($disabled ? 0.5 : 1)};
`;

const PressedOverlay = styled.View`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.08);
`;

const Label = styled.Text<{ $size: Size }>`
  font-weight: 600;
  text-align: center;
  font-size: ${({ theme, $size }) => `${$size === 'sm' ? theme.font.sm : theme.font.base}px`};
`;

/** Botão só de ícone (editar, excluir, reordenar). */
export const IconButton = styled.Pressable<{ $danger?: boolean }>`
  width: 40px;
  height: 40px;
  align-items: center;
  justify-content: center;
  border-radius: ${radius('sm')};
  border-width: 1px;
  border-color: ${({ theme, $danger }) => ($danger ? theme.colors.dangerBorder : theme.colors.border)};
  background-color: ${({ theme }) => theme.colors.surfaceRaised};
`;

/** Botões lado a lado ("Cancelar" · "Salvar"). */
export const ButtonRow = styled.View`
  flex-direction: row;
  gap: ${space(3)};
`;

/** Ocupa metade da linha dentro de um ButtonRow. */
export const ButtonCell = styled.View`
  flex: 1;
`;
