import { useState } from 'react';
import { Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import styled, { useTheme } from 'styled-components/native';
import { buildThumbnailUrl, buildWatchUrl, isValidVideoId } from '../../utils/youtube';
import { color, font, radius, space } from '../../theme/theme';

interface VideoPlayerProps {
  videoId: string | null;
  /** Nome do exercício, usado no rótulo acessível. */
  exerciseName: string;
}

/**
 * Capa do vídeo demonstrativo; o toque abre no app do YouTube.
 *
 * Na versão web o vídeo tocava num iframe. No celular, abrir o app do
 * YouTube é melhor: tela cheia, controles nativos, e nenhum módulo
 * nativo extra (WebView) para o app carregar. Até o toque, o custo é
 * uma miniatura de ~15 KB.
 */
export function VideoPlayer({ videoId, exerciseName }: VideoPlayerProps) {
  const theme = useTheme();
  const [thumbnailFailed, setThumbnailFailed] = useState(false);

  // Validamos de novo na renderização: um dado antigo ou inconsistente
  // não pode virar um link apontando para lugar nenhum.
  if (!videoId || !isValidVideoId(videoId)) {
    return (
      <Placeholder>
        <Ionicons name="videocam-off-outline" size={24} color={theme.colors.textSubtle} />
        <PlaceholderText>Nenhum vídeo cadastrado para este exercício.</PlaceholderText>
      </Placeholder>
    );
  }

  return (
    <Facade
      onPress={() => void Linking.openURL(buildWatchUrl(videoId))}
      accessibilityRole="link"
      accessibilityLabel={`Assistir vídeo demonstrativo de ${exerciseName} no YouTube`}
    >
      {/* Vídeo removido ou privado: a miniatura falha, escondemos a
          imagem quebrada e mantemos o botão de play. */}
      {!thumbnailFailed && (
        <Thumbnail
          source={{ uri: buildThumbnailUrl(videoId) }}
          resizeMode="cover"
          onError={() => setThumbnailFailed(true)}
        />
      )}
      <PlayButton>
        <Ionicons name="play" size={26} color="#ffffff" />
      </PlayButton>
    </Facade>
  );
}

/**
 * Botão que mostra e esconde a capa do vídeo. Usado nas telas de
 * ficha e de treino, onde deixar sete capas abertas de uma vez
 * roubaria o espaço das informações que realmente importam durante o
 * exercício — por isso o botão continua visível para recolher.
 */
export function VideoToggle({ videoId, exerciseName }: VideoPlayerProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  if (!videoId || !isValidVideoId(videoId)) return null;

  return (
    <ToggleWrapper>
      <Trigger
        onPress={() => setOpen((current) => !current)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${open ? 'Ocultar' : 'Ver'} vídeo de ${exerciseName}`}
      >
        <Ionicons name={open ? 'chevron-up' : 'logo-youtube'} size={18} color={theme.colors.accent} />
        <TriggerText>{open ? 'Ocultar vídeo' : 'Ver vídeo'}</TriggerText>
      </Trigger>

      {open && <VideoPlayer videoId={videoId} exerciseName={exerciseName} />}
    </ToggleWrapper>
  );
}

const ToggleWrapper = styled.View`
  gap: ${space(3)};
`;

const Placeholder = styled.View`
  align-items: center;
  gap: ${space(2)};
  padding: ${space(5)};
  border-radius: ${radius('md')};
  background-color: ${color('surfaceRaised')};
`;

const PlaceholderText = styled.Text`
  color: ${color('textSubtle')};
  font-size: ${font('sm')};
`;

const Facade = styled.Pressable`
  width: 100%;
  aspect-ratio: 1.778;
  border-radius: ${radius('md')};
  overflow: hidden;
  align-items: center;
  justify-content: center;
  background-color: #000000;
`;

const Thumbnail = styled.Image`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
`;

const PlayButton = styled.View`
  width: 64px;
  height: 44px;
  border-radius: 12px;
  align-items: center;
  justify-content: center;
  background-color: rgba(230, 33, 23, 0.92);
`;

const Trigger = styled.Pressable`
  flex-direction: row;
  align-items: center;
  align-self: flex-start;
  gap: ${space(2)};
  padding: ${space(2)} ${space(3)};
  border-radius: ${radius('md')};
  border-width: 1px;
  border-color: ${color('accentBorder')};
  background-color: ${color('accentSoft')};
`;

const TriggerText = styled.Text`
  color: ${color('accent')};
  font-size: ${font('sm')};
  font-weight: 600;
`;
