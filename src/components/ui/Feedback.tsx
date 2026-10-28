import type { ReactNode } from 'react';
import { ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import styled, { useTheme } from 'styled-components/native';
import { color, font, radius, space } from '../../theme/theme';

/**
 * Estados de tela: carregando, vazio e erro.
 *
 * Toda listagem do app passa por estes componentes, para que a
 * experiência seja a mesma em qualquer lugar e nenhuma tela fique
 * "em branco" sem explicação.
 */

interface LoadingProps {
  /** Descreva a ação: "Carregando treino…", "Salvando exercício…". */
  message?: string;
  fullScreen?: boolean;
}

export function Loading({ message = 'Carregando…', fullScreen = false }: LoadingProps) {
  const theme = useTheme();
  return (
    <LoadingBox $fullScreen={fullScreen} accessibilityRole="progressbar" accessibilityLabel={message}>
      <ActivityIndicator size="large" color={theme.colors.accent} />
      <LoadingText>{message}</LoadingText>
    </LoadingBox>
  );
}

/** Bloco cinza no lugar do conteúdo que ainda vai chegar. */
export function Skeleton({ height = 64 }: { height?: number }) {
  return <SkeletonBox style={{ height }} />;
}

interface EmptyStateProps {
  title: string;
  /** Diga o que fazer a seguir, não apenas que está vazio. */
  message?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  action?: ReactNode;
}

export function EmptyState({ title, message, icon, action }: EmptyStateProps) {
  const theme = useTheme();
  return (
    <EmptyBox>
      {icon && (
        <EmptyIcon>
          <Ionicons name={icon} size={26} color={theme.colors.accent} />
        </EmptyIcon>
      )}
      <EmptyTitle>{title}</EmptyTitle>
      {message && <EmptyMessage>{message}</EmptyMessage>}
      {action && <EmptyAction>{action}</EmptyAction>}
    </EmptyBox>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  action?: ReactNode;
}

export function ErrorState({ title = 'Não foi possível carregar', message, action }: ErrorStateProps) {
  const theme = useTheme();
  return (
    <ErrorBox accessibilityRole="alert">
      <Ionicons name="warning-outline" size={28} color={theme.colors.danger} />
      <ErrorTitle>{title}</ErrorTitle>
      <EmptyMessage>{message}</EmptyMessage>
      {action && <EmptyAction>{action}</EmptyAction>}
    </ErrorBox>
  );
}

/** Erro dentro de um formulário, acima dos botões de ação. */
export function InlineError({ message }: { message: string }) {
  const theme = useTheme();
  return (
    <InlineBox accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Ionicons name="alert-circle-outline" size={16} color={theme.colors.danger} />
      <InlineText>{message}</InlineText>
    </InlineBox>
  );
}

/** Aviso informativo (ciclo encerrado, catálogo vazio…). */
export function Notice({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'warning' }) {
  return (
    <NoticeBox $tone={tone}>
      {typeof children === 'string' ? <NoticeText>{children}</NoticeText> : children}
    </NoticeBox>
  );
}

const LoadingBox = styled.View<{ $fullScreen: boolean }>`
  align-items: center;
  justify-content: center;
  gap: ${space(3)};
  padding: ${space(10)} ${space(4)};
  ${({ $fullScreen, theme }) => ($fullScreen ? `flex: 1; background-color: ${theme.colors.bg};` : '')}
`;

const LoadingText = styled.Text`
  color: ${color('textMuted')};
  font-size: ${font('sm')};
`;

const SkeletonBox = styled.View`
  border-radius: ${radius('lg')};
  background-color: ${color('surface')};
`;

const EmptyBox = styled.View`
  align-items: center;
  padding: ${space(8)} ${space(4)};
  border-radius: ${radius('lg')};
  border-width: 1px;
  border-style: dashed;
  border-color: ${color('border')};
  gap: ${space(2)};
`;

const EmptyIcon = styled.View`
  width: 56px;
  height: 56px;
  border-radius: 28px;
  align-items: center;
  justify-content: center;
  background-color: ${color('accentSoft')};
  margin-bottom: ${space(2)};
`;

const EmptyTitle = styled.Text`
  color: ${color('text')};
  font-size: ${font('lg')};
  font-weight: 700;
  text-align: center;
`;

const EmptyMessage = styled.Text`
  color: ${color('textMuted')};
  font-size: ${font('sm')};
  line-height: 20px;
  text-align: center;
`;

const EmptyAction = styled.View`
  margin-top: ${space(3)};
  align-self: stretch;
  align-items: center;
  gap: ${space(3)};
`;

const ErrorBox = styled(EmptyBox)`
  border-style: solid;
  border-color: ${color('dangerBorder')};
  background-color: ${color('dangerSoft')};
`;

const ErrorTitle = styled(EmptyTitle)`
  font-size: ${font('base')};
`;

const InlineBox = styled.View`
  flex-direction: row;
  align-items: flex-start;
  gap: ${space(2)};
  padding: ${space(3)};
  border-radius: ${radius('md')};
  border-width: 1px;
  border-color: ${color('dangerBorder')};
  background-color: ${color('dangerSoft')};
`;

const InlineText = styled.Text`
  flex: 1;
  color: ${color('danger')};
  font-size: ${font('sm')};
  line-height: 20px;
`;

const NoticeBox = styled.View<{ $tone: 'neutral' | 'warning' }>`
  padding: ${space(3)} ${space(4)};
  border-radius: ${radius('md')};
  border-width: 1px;
  border-color: ${({ theme, $tone }) => ($tone === 'warning' ? theme.colors.warning : theme.colors.border)};
  background-color: ${({ theme, $tone }) =>
    $tone === 'warning' ? theme.colors.warningSoft : theme.colors.surface};
  gap: ${space(3)};
`;

const NoticeText = styled.Text`
  color: ${color('textMuted')};
  font-size: ${font('sm')};
  line-height: 20px;
`;
