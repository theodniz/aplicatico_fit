/**
 * Tokens de design, consumidos pelo styled-components via ThemeProvider.
 *
 * Os mesmos valores do `tokens.css` da versão web. Nenhuma cor solta
 * nos componentes — é isso que permite trocar o tema inteiro mexendo
 * em um arquivo só.
 *
 * O tema escuro é o padrão: o app é usado em academia, onde uma
 * tela branca no escuro incomoda e consome mais bateria em OLED.
 */
export const theme = {
  colors: {
    // ----- Superfícies -----
    bg: '#0d0f14',
    surface: '#161a22',
    surfaceRaised: '#1e232d',
    surfaceHover: '#252b36',
    border: '#2a3038',
    borderStrong: '#3a424e',
    backdrop: 'rgba(0, 0, 0, 0.6)',

    // ----- Texto -----
    text: '#f2f4f7',
    textMuted: '#9aa4b2',
    textSubtle: '#6b7684',
    textOnAccent: '#062b17',

    // ----- Marca -----
    accent: '#22d37a',
    accentHover: '#1ab868',
    accentSoft: 'rgba(34, 211, 122, 0.12)',
    accentBorder: 'rgba(34, 211, 122, 0.35)',

    // ----- Estados -----
    danger: '#f2555a',
    dangerSoft: 'rgba(242, 85, 90, 0.12)',
    dangerBorder: 'rgba(242, 85, 90, 0.35)',
    warning: '#f5b544',
    warningSoft: 'rgba(245, 181, 68, 0.12)',
    info: '#6aa9ff',
    infoSoft: 'rgba(106, 169, 255, 0.12)',
  },

  /** Escala de 4px, em pixels (1rem = 16px na versão web). */
  space: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48 },

  radius: { sm: 8, md: 12, lg: 16, xl: 20, full: 999 },

  /** Tamanhos generosos: o app é lido de relance, a um braço de distância. */
  font: { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, xxl: 24, xxxl: 30, huge: 36 },
} as const;

export type AppTheme = typeof theme;
export type ColorName = keyof AppTheme['colors'];
export type SpaceStep = keyof AppTheme['space'];
export type FontSize = keyof AppTheme['font'];
export type RadiusName = keyof AppTheme['radius'];

/**
 * Atalhos para interpolar o tema dentro dos templates do
 * styled-components sem repetir `({ theme }) => ...` em toda linha:
 *
 *   padding: ${space(4)};   color: ${color('textMuted')};
 */
type ThemeProps = { theme: AppTheme };

export const color = (name: ColorName) => ({ theme: t }: ThemeProps) => t.colors[name];
export const space = (step: SpaceStep) => ({ theme: t }: ThemeProps) => `${t.space[step]}px`;
export const font = (size: FontSize) => ({ theme: t }: ThemeProps) => `${t.font[size]}px`;
export const radius = (name: RadiusName) => ({ theme: t }: ThemeProps) => `${t.radius[name]}px`;
