import styled from 'styled-components/native';
import { color, font, space } from '../../theme/theme';

/**
 * Tipografia compartilhada.
 *
 * No React Native não há herança de estilo de texto como no CSS: todo
 * `<Text>` precisa da própria cor e tamanho. Centralizar aqui evita
 * texto preto padrão aparecendo no tema escuro.
 */

export const Title = styled.Text`
  color: ${color('text')};
  font-size: ${font('xxl')};
  font-weight: 700;
`;

export const Subtitle = styled.Text`
  color: ${color('textMuted')};
  font-size: ${font('sm')};
  line-height: 20px;
`;

export const SectionTitle = styled.Text`
  color: ${color('textMuted')};
  font-size: ${font('xs')};
  font-weight: 700;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  margin-bottom: ${space(3)};
`;

export const Body = styled.Text`
  color: ${color('text')};
  font-size: ${font('base')};
  line-height: 22px;
`;

export const Muted = styled.Text`
  color: ${color('textMuted')};
  font-size: ${font('sm')};
  line-height: 20px;
`;

export const Strong = styled.Text`
  color: ${color('text')};
  font-weight: 700;
`;

/** Etiqueta pequena (grupo muscular, "vídeo", "admin"). */
export const Tag = styled.Text<{ $accent?: boolean }>`
  align-self: flex-start;
  overflow: hidden;
  padding: 2px ${space(2)};
  border-radius: 6px;
  font-size: ${font('xs')};
  font-weight: 600;
  color: ${({ theme, $accent }) => ($accent ? theme.colors.accent : theme.colors.textMuted)};
  background-color: ${({ theme, $accent }) =>
    $accent ? theme.colors.accentSoft : theme.colors.surfaceRaised};
`;

/** Linha que quebra itens pequenos lado a lado. */
export const Wrap = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: ${space(2)};
`;

/** Caixa padrão de conteúdo. */
export const Card = styled.View<{ $active?: boolean }>`
  padding: ${space(4)};
  border-radius: 16px;
  border-width: 1px;
  border-color: ${({ theme, $active }) => ($active ? theme.colors.accentBorder : theme.colors.border)};
  background-color: ${color('surface')};
  gap: ${space(3)};
`;

/** Bloco de seção com espaçamento inferior. */
export const Section = styled.View`
  margin-bottom: ${space(6)};
`;
