import styled from 'styled-components/native';
import { color, font, space } from '../../theme/theme';
import { Modal } from './Modal';
import { Button, ButtonCell, ButtonRow } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Deve deixar claro o que será perdido. */
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmação para ações irreversíveis.
 *
 * Feito sobre o Modal próprio, e não com `Alert.alert`: o Alert não
 * mostra botões no Snack web e não exibe estado de carregamento.
 *
 * - "Cancelar" vem primeiro, então a opção segura é a que o polegar
 *   alcança por acidente.
 * - O botão de confirmar mostra spinner e trava durante a operação,
 *   impedindo excluir duas vezes.
 * - O diálogo não fecha sozinho: quem fecha é o chamador, depois que o
 *   servidor confirmou.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Excluir',
  cancelLabel = 'Cancelar',
  destructive = true,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title} busy={loading}>
      <Message>{message}</Message>

      <ButtonRow>
        <ButtonCell>
          <Button variant="secondary" onPress={onCancel} disabled={loading} fullWidth>
            {cancelLabel}
          </Button>
        </ButtonCell>
        <ButtonCell>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            onPress={onConfirm}
            loading={loading}
            fullWidth
          >
            {confirmLabel}
          </Button>
        </ButtonCell>
      </ButtonRow>
    </Modal>
  );
}

const Message = styled.Text`
  color: ${color('textMuted')};
  font-size: ${font('base')};
  line-height: 22px;
  margin-bottom: ${space(6)};
`;
