import { buildEmbedUrl, extractVideoId, isValidVideoId } from './youtube';

/**
 * O parser de URL do YouTube é uma fronteira de segurança: é ele
 * que decide o que pode virar `src` de um iframe. Um furo aqui
 * significa conteúdo de terceiros embutido na aplicação.
 */

const VIDEO_ID = 'dQw4w9WgXcQ';

describe('extractVideoId', () => {
  it('aceita os formatos de URL que o YouTube realmente usa', () => {
    const urls = [
      `https://www.youtube.com/watch?v=${VIDEO_ID}`,
      `http://www.youtube.com/watch?v=${VIDEO_ID}`,
      `https://youtube.com/watch?v=${VIDEO_ID}`,
      `https://m.youtube.com/watch?v=${VIDEO_ID}`,
      `https://music.youtube.com/watch?v=${VIDEO_ID}`,
      `https://youtu.be/${VIDEO_ID}`,
      `https://www.youtube.com/embed/${VIDEO_ID}`,
      `https://www.youtube.com/shorts/${VIDEO_ID}`,
      `https://www.youtube.com/live/${VIDEO_ID}`,
      `https://www.youtube-nocookie.com/embed/${VIDEO_ID}`,
      // Sem protocolo: é como muita gente cola o endereço.
      `youtube.com/watch?v=${VIDEO_ID}`,
      `www.youtube.com/watch?v=${VIDEO_ID}`,
    ];

    for (const url of urls) {
      expect({ input: url, result: extractVideoId(url) }).toEqual({ input: url, result: VIDEO_ID });
    }
  });

  it('ignora parâmetros extras de tempo, playlist e rastreamento', () => {
    expect(extractVideoId(`https://youtu.be/${VIDEO_ID}?t=42`)).toBe(VIDEO_ID);
    expect(extractVideoId(`https://www.youtube.com/watch?v=${VIDEO_ID}&t=30s`)).toBe(VIDEO_ID);
    expect(extractVideoId(`https://www.youtube.com/watch?v=${VIDEO_ID}&list=PL123&index=2`)).toBe(
      VIDEO_ID,
    );
    expect(
      extractVideoId(`https://www.youtube.com/watch?app=desktop&v=${VIDEO_ID}&feature=share`),
    ).toBe(VIDEO_ID);
  });

  it('aceita links de compartilhamento com caracteres invisíveis ou texto em volta', () => {
    // Como o link chega quando copiado do WhatsApp, de notas ou do
    // botão "Compartilhar" do app do YouTube.
    const urls = [
      `​https://youtu.be/${VIDEO_ID}`,
      `https://youtu.be/${VIDEO_ID}​`,
      `﻿https://www.youtube.com/watch?v=${VIDEO_ID}`,
      `Supino reto com barra https://youtu.be/${VIDEO_ID}?si=AbC123`,
      `https://youtube.com/shorts/${VIDEO_ID}?si=AbC123.`,
      `Veja: https://www.youtube.com/watch?v=${VIDEO_ID} (execução correta)`,
    ];

    for (const url of urls) {
      expect({ input: url, result: extractVideoId(url) }).toEqual({ input: url, result: VIDEO_ID });
    }
  });

  it('não aceita link de outro site só porque há texto em volta', () => {
    expect(extractVideoId(`Vídeo https://evil.com/watch?v=${VIDEO_ID}`)).toBeNull();
    expect(extractVideoId(`assista youtube.com.evil.net/watch?v=${VIDEO_ID} agora`)).toBeNull();
  });

  it('aceita o ID digitado diretamente', () => {
    expect(extractVideoId(VIDEO_ID)).toBe(VIDEO_ID);
    expect(extractVideoId(`  ${VIDEO_ID}  `)).toBe(VIDEO_ID);
  });

  it('devolve null para entradas vazias', () => {
    expect(extractVideoId('')).toBeNull();
    expect(extractVideoId('   ')).toBeNull();
    expect(extractVideoId(null)).toBeNull();
    expect(extractVideoId(undefined)).toBeNull();
  });

  it('rejeita hosts que não são do YouTube', () => {
    // O ponto central: nenhum destes pode acabar dentro do iframe.
    const hostile = [
      `https://evil.com/watch?v=${VIDEO_ID}`,
      `https://vimeo.com/${VIDEO_ID}`,
      // Domínio que apenas TERMINA com youtube.com como texto.
      `https://notyoutube.com/watch?v=${VIDEO_ID}`,
      `https://youtube.com.evil.net/watch?v=${VIDEO_ID}`,
      // Subdomínio de atacante sob domínio parecido.
      `https://www.youtube.evil.com/watch?v=${VIDEO_ID}`,
    ];

    for (const url of hostile) {
      expect({ input: url, result: extractVideoId(url) }).toEqual({ input: url, result: null });
    }
  });

  it('rejeita esquemas perigosos', () => {
    expect(extractVideoId('javascript:alert(1)')).toBeNull();
    expect(extractVideoId('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(extractVideoId(`javascript:://youtube.com/watch?v=${VIDEO_ID}`)).toBeNull();
  });

  it('rejeita IDs com formato inválido', () => {
    expect(extractVideoId('https://www.youtube.com/watch?v=curto')).toBeNull();
    expect(extractVideoId('https://www.youtube.com/watch?v=idlongodemaisparaservalido')).toBeNull();
    // 11 caracteres, mas com símbolo fora do alfabeto permitido.
    expect(extractVideoId('https://www.youtube.com/watch?v=abc!def$ghi')).toBeNull();
    expect(extractVideoId('https://www.youtube.com/watch')).toBeNull();
    expect(extractVideoId('https://www.youtube.com/')).toBeNull();
  });
});

describe('isValidVideoId', () => {
  it('valida exatamente 11 caracteres do alfabeto do YouTube', () => {
    expect(isValidVideoId(VIDEO_ID)).toBe(true);
    expect(isValidVideoId('a-b_c1D2E3F')).toBe(true);
    expect(isValidVideoId('curto')).toBe(false);
    expect(isValidVideoId('doze-caracts')).toBe(false);
    expect(isValidVideoId('onze chars!')).toBe(false);
    expect(isValidVideoId('')).toBe(false);
  });
});

describe('buildEmbedUrl', () => {
  it('sempre aponta para o domínio sem cookies do YouTube', () => {
    const url = buildEmbedUrl(VIDEO_ID);
    expect(url.startsWith(`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?`)).toBe(true);
  });

  it('inclui playsinline, necessário para o vídeo tocar embutido no iOS', () => {
    expect(buildEmbedUrl(VIDEO_ID)).toContain('playsinline=1');
  });
});
