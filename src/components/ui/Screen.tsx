import type { ReactNode } from 'react';
import { RefreshControl } from 'react-native';
import styled, { useTheme } from 'styled-components/native';
import { color, font, space } from '../../theme/theme';

interface ScreenProps {
  children: ReactNode;
  /** Texto de apoio abaixo do título do cabeçalho. */
  subtitle?: string;
  /** Ação principal da tela, à direita do subtítulo ("Nova", "Novo"). */
  action?: ReactNode;
  /** Puxar para atualizar. */
  onRefresh?: () => void;
  refreshing?: boolean;
}

/**
 * Moldura rolável das telas.
 *
 * O título fica no cabeçalho do React Navigation; aqui vão o
 * subtítulo e a ação principal, e o conteúdo com o espaçamento
 * padrão. "Puxar para atualizar" substitui o F5 da versão web.
 */
export function Screen({ children, subtitle, action, onRefresh, refreshing = false }: ScreenProps) {
  const theme = useTheme();

  return (
    <Scroll
      contentContainerStyle={{ padding: theme.space[4], paddingBottom: theme.space[12] }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
          />
        ) : undefined
      }
    >
      {(subtitle || action) && (
        <Toolbar>
          {subtitle ? <ToolbarText>{subtitle}</ToolbarText> : <Spacer />}
          {action}
        </Toolbar>
      )}
      {children}
    </Scroll>
  );
}

const Scroll = styled.ScrollView`
  flex: 1;
  background-color: ${color('bg')};
`;

const Toolbar = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: ${space(3)};
  margin-bottom: ${space(5)};
`;

const ToolbarText = styled.Text`
  flex: 1;
  color: ${color('textMuted')};
  font-size: ${font('sm')};
  line-height: 20px;
`;

const Spacer = styled.View`
  flex: 1;
`;
