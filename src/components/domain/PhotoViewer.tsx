import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import styled from 'styled-components/native';
import { font, radius, space } from '../../theme/theme';

interface PhotoViewerProps {
  photos: string[];
  /** Foto aberta; null fecha o visualizador. */
  startIndex: number | null;
  onClose: () => void;
  title?: string;
}

/**
 * Fotos em tela cheia, deslizando para o lado entre elas.
 *
 * Fecha pelo X, pelo "voltar" do Android ou tocando fora da foto.
 */
export function PhotoViewer({ photos, startIndex, onClose, title }: PhotoViewerProps) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const open = startIndex !== null && photos.length > 0;

  // Reinicia a contagem ao abrir em outra foto.
  const [openedAt, setOpenedAt] = useState<number | null>(null);
  if (startIndex !== openedAt) {
    setOpenedAt(startIndex);
    setIndex(startIndex ?? 0);
  }

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Backdrop>
        <SafeAreaView style={{ flex: 1 }}>
          <Header>
            <HeaderText numberOfLines={1}>
              {title ? `${title} · ` : ''}
              {photos.length > 1 ? `${index + 1} de ${photos.length}` : 'Foto do treino'}
            </HeaderText>
            <CloseButton onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar foto" hitSlop={12}>
              <Ionicons name="close" size={24} color="#ffffff" />
            </CloseButton>
          </Header>

          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleScroll}
            // `contentOffset` só funciona no iOS; rolar assim que as fotos
            // têm tamanho abre na foto certa também no Android.
            onContentSizeChange={() =>
              scrollRef.current?.scrollTo({ x: (startIndex ?? 0) * width, animated: false })
            }
          >
            {photos.map((uri) => (
              <Pressable key={uri} onPress={onClose} style={{ width, flex: 1 }} accessibilityLabel="Fechar foto">
                <FullPhoto source={{ uri }} resizeMode="contain" accessibilityLabel="Foto de registro do treino" />
              </Pressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Backdrop>
    </Modal>
  );
}

const Backdrop = styled.View`
  flex: 1;
  background-color: rgba(0, 0, 0, 0.95);
`;

const Header = styled.View`
  flex-direction: row;
  align-items: center;
  gap: ${space(3)};
  padding: ${space(3)} ${space(4)};
`;

const HeaderText = styled.Text`
  flex: 1;
  color: #ffffff;
  font-size: ${font('base')};
  font-weight: 600;
`;

const CloseButton = styled.Pressable`
  width: 40px;
  height: 40px;
  border-radius: ${radius('full')};
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.15);
`;

const FullPhoto = styled.Image`
  flex: 1;
  width: 100%;
`;
