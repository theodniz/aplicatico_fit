import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal as NativeModal, Platform, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import styled, { useTheme } from 'styled-components/native';
import { color, font, radius, space } from '../../theme/theme';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Impede o fechamento enquanto uma operação está em andamento. */
  busy?: boolean;
}

/**
 * Folha inferior (bottom sheet) sobre o `Modal` nativo.
 *
 * Abre de baixo, onde o polegar alcança. O fechamento — toque no
 * fundo, botão X ou "voltar" do Android — passa sempre por `onClose`
 * e respeita `busy`, para ninguém fechar o formulário no meio do
 * salvamento e ficar sem saber se deu certo.
 */
export function Modal({ open, onClose, title, children, busy = false }: ModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const requestClose = () => {
    if (!busy) onClose();
  };

  return (
    <NativeModal visible={open} transparent animationType="slide" onRequestClose={requestClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Backdrop>
          <Pressable
            style={{ flex: 1 }}
            onPress={requestClose}
            accessibilityLabel="Fechar"
            accessibilityRole="button"
          />
          <Panel style={{ paddingBottom: insets.bottom + 16 }}>
            <Grabber />
            <Header>
              <ModalTitle accessibilityRole="header">{title}</ModalTitle>
              <Pressable
                onPress={requestClose}
                disabled={busy}
                accessibilityLabel="Fechar"
                accessibilityRole="button"
                hitSlop={12}
              >
                <Ionicons name="close" size={22} color={theme.colors.textMuted} />
              </Pressable>
            </Header>
            <Body keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 8 }}>
              {children}
            </Body>
          </Panel>
        </Backdrop>
      </KeyboardAvoidingView>
    </NativeModal>
  );
}

const Backdrop = styled.View`
  flex: 1;
  background-color: ${color('backdrop')};
`;

const Panel = styled.View`
  max-height: 90%;
  padding: ${space(2)} ${space(4)} 0;
  border-top-left-radius: ${radius('xl')};
  border-top-right-radius: ${radius('xl')};
  background-color: ${color('surface')};
  border-width: 1px;
  border-color: ${color('border')};
`;

const Grabber = styled.View`
  align-self: center;
  width: 40px;
  height: 4px;
  border-radius: 2px;
  margin-bottom: ${space(3)};
  background-color: ${color('borderStrong')};
`;

const Header = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${space(4)};
`;

const ModalTitle = styled.Text`
  flex: 1;
  color: ${color('text')};
  font-size: ${font('lg')};
  font-weight: 700;
`;

const Body = styled.ScrollView``;
