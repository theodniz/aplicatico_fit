import 'styled-components/native';
import type { AppTheme } from './theme';

// Tipagem do tema: faz `props.theme.colors.accent` ter autocomplete e
// acusar erro de compilação para uma cor que não existe.
declare module 'styled-components/native' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface DefaultTheme extends AppTheme {}
}
