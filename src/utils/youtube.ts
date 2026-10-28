/**
 * Normalização de URLs do YouTube.
 *
 * Guardamos no banco apenas o ID de 11 caracteres, nunca a URL
 * completa. Duas razões:
 *
 * 1. SEGURANÇA — o link aberto pelo app é montado por nós a partir de
 *    um ID já validado contra /^[A-Za-z0-9_-]{11}$/. Se guardássemos a
 *    URL crua, alguém poderia salvar `javascript:...` ou apontar o
 *    botão de vídeo para um site arbitrário. Com o ID normalizado, o
 *    destino é sempre youtube.com.
 *
 * 2. ROBUSTEZ — o YouTube tem meia dúzia de formatos de URL. Resolver
 *    isso uma vez na entrada é mais simples do que tratar todos eles
 *    toda vez que um vídeo for exibido.
 *
 * O parser NÃO usa `new URL()`: no React Native o `URL` embutido é
 * incompleto (`hostname`, `pathname` e `searchParams` lançam "not
 * implemented" em várias versões). A decomposição é feita à mão com
 * uma regex ancorada, que cobre o mesmo recorte de formatos.
 */

/** Formato canônico de um ID de vídeo do YouTube. */
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/** Hosts aceitos. Qualquer outro é rejeitado. */
const ALLOWED_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

/** Caminhos que carregam o ID no primeiro segmento após o prefixo. */
const PATH_PREFIXES = ['/embed/', '/shorts/', '/v/', '/live/'];

/**
 * protocolo opcional (só http/https) · host · caminho · query.
 * O host não aceita `:`, `/`, `?`, `#` nem `@`, o que impede truques
 * como `youtube.com@evil.net` ou `javascript:://youtube.com`.
 */
const URL_PATTERN = /^(?:https?:\/\/)?([^/?#:@\s]+)(\/[^?#\s]*)?(?:\?([^#\s]*))?(?:#.*)?$/i;

export function isValidVideoId(value: string): boolean {
  return VIDEO_ID_PATTERN.test(value);
}

/** Lê um parâmetro da query string sem depender de URLSearchParams. */
function readQueryParam(query: string, name: string): string | null {
  for (const pair of query.split('&')) {
    const [key, value = ''] = pair.split('=');
    if (key === name) {
      try {
        return decodeURIComponent(value);
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Extrai o ID do vídeo de qualquer formato aceito de URL do YouTube.
 * Devolve `null` se a entrada não for um vídeo do YouTube reconhecível.
 *
 * Aceita:
 *   https://www.youtube.com/watch?v=dQw4w9WgXcQ
 *   https://youtu.be/dQw4w9WgXcQ?t=30
 *   https://www.youtube.com/embed/dQw4w9WgXcQ
 *   https://www.youtube.com/shorts/dQw4w9WgXcQ
 *   dQw4w9WgXcQ                       (ID digitado direto)
 *   Supino reto https://youtu.be/…    (link no meio de um texto)
 */
export function extractVideoId(input: string | null | undefined): string | null {
  if (!input) return null;

  // Caracteres invisíveis (espaço de largura zero, BOM) vêm junto ao
  // copiar de WhatsApp, notas ou da área de transferência do iPhone.
  // Não aparecem na tela, mas fariam o link parecer inválido.
  const cleaned = input.replace(/[​-‍⁠﻿]/g, '').trim();
  if (!cleaned) return null;

  // Caso mais simples: o usuário colou só o ID.
  if (isValidVideoId(cleaned)) return cleaned;

  // Ao compartilhar, o link às vezes vem com o título do vídeo antes
  // ou um ponto final depois. Cada pedaço passa pela mesma validação
  // de host abaixo, então isso não abre brecha para outro domínio.
  for (const token of cleaned.split(/\s+/)) {
    const id = extractFromUrl(token.replace(/[.,;:!?)\]]+$/, ''));
    if (id) return id;
  }
  return null;
}

/** Extrai o ID de UMA url, ou null se ela não for do YouTube. */
function extractFromUrl(value: string): string | null {
  const match = URL_PATTERN.exec(value);
  if (!match) return null;

  const host = (match[1] ?? '').toLowerCase();
  const path = match[2] ?? '/';
  const query = match[3] ?? '';

  // Rejeita qualquer host fora da allowlist. É isto que impede que
  // um link de outro domínio seja aberto como "vídeo do exercício".
  if (!ALLOWED_HOSTS.has(host)) return null;

  // youtu.be/VIDEO_ID — o ID é o caminho inteiro.
  if (host.endsWith('youtu.be')) {
    const candidate = path.slice(1).split('/')[0] ?? '';
    return isValidVideoId(candidate) ? candidate : null;
  }

  // youtube.com/watch?v=VIDEO_ID
  const queryId = readQueryParam(query, 'v');
  if (queryId && isValidVideoId(queryId)) return queryId;

  // youtube.com/embed|shorts|v|live/VIDEO_ID
  for (const prefix of PATH_PREFIXES) {
    if (path.startsWith(prefix)) {
      const candidate = path.slice(prefix.length).split('/')[0] ?? '';
      return isValidVideoId(candidate) ? candidate : null;
    }
  }

  return null;
}

/**
 * URL de incorporação. Usa o domínio `youtube-nocookie.com`, que não
 * grava cookies de rastreamento até o vídeo começar a tocar.
 */
export function buildEmbedUrl(videoId: string): string {
  // rel=0: sugestões apenas do mesmo canal ao terminar.
  // playsinline=1: no iOS toca embutido em vez de abrir em tela cheia.
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`;
}

/** Miniatura do vídeo, usada como capa antes de abrir o player. */
export function buildThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/** Link para abrir o vídeo no app/site do YouTube. */
export function buildWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}
