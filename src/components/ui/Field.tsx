import { Children, useState } from 'react';
import type { ReactNode } from 'react';
import type { TextInputProps } from 'react-native';
import styled, { useTheme } from 'styled-components/native';
import { color, font, radius, space } from '../../theme/theme';

interface BaseFieldProps {
  label: string;
  error?: string | undefined;
  hint?: string;
  required?: boolean;
}

/**
 * Envelope de campo de formulário: rótulo, controle, dica e erro.
 *
 * O erro substitui a dica (nunca os dois juntos) e é anunciado ao
 * leitor de tela via `accessibilityLiveRegion`.
 */
function FieldShell({ label, error, hint, required, children }: BaseFieldProps & { children: ReactNode }) {
  return (
    <FieldWrapper>
      <FieldLabel>
        {label}
        {required && <RequiredMark> *</RequiredMark>}
      </FieldLabel>

      {children}

      {hint && !error && <Hint>{hint}</Hint>}
      {error && (
        <ErrorText accessibilityLiveRegion="polite" accessibilityRole="alert">
          {error}
        </ErrorText>
      )}
    </FieldWrapper>
  );
}

type InputProps = BaseFieldProps & Omit<TextInputProps, 'style'> & { disabled?: boolean };

export function Input({ label, error, hint, required, disabled, editable, ...rest }: InputProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <FieldShell label={label} error={error} hint={hint} required={required}>
      <Control
        $invalid={Boolean(error)}
        $focused={focused}
        $disabled={Boolean(disabled) || editable === false}
        editable={!disabled && editable !== false}
        placeholderTextColor={theme.colors.textSubtle}
        accessibilityLabel={label}
        onFocus={(event) => {
          setFocused(true);
          rest.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          rest.onBlur?.(event);
        }}
        {...rest}
      />
    </FieldShell>
  );
}

export function TextArea(props: InputProps) {
  return <Input multiline numberOfLines={3} textAlignVertical="top" {...props} />;
}

// ---------------------------------------------------------------
// Data
// ---------------------------------------------------------------

/** 'YYYY-MM-DD' → 'DD/MM/AAAA' */
function isoToDisplay(value: string): string {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : '';
}

/** 'DD/MM/AAAA' → 'YYYY-MM-DD', ou '' se a data não existir (31/02). */
function displayToIso(value: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return '';
  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  const valid =
    date.getFullYear() === Number(year) &&
    date.getMonth() === Number(month) - 1 &&
    date.getDate() === Number(day);
  return valid ? `${year}-${month}-${day}` : '';
}

/** Insere as barras enquanto o usuário digita: 01082026 → 01/08/2026. */
function maskDate(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

interface DateInputProps extends BaseFieldProps {
  /** 'YYYY-MM-DD', ou '' enquanto a data estiver incompleta/inválida. */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * Campo de data DD/MM/AAAA.
 *
 * Não há `<input type="date">` no React Native. Um campo com máscara
 * funciona igual em Android, iOS e web (Snack), sem módulo nativo.
 * Por fora, o valor continua 'YYYY-MM-DD' — o mesmo formato que as
 * validações e o Firestore usam.
 */
export function DateInput({ value, onChange, disabled, ...shell }: DateInputProps) {
  const [text, setText] = useState(isoToDisplay(value));
  const [syncedValue, setSyncedValue] = useState(value);

  // Ressincroniza quando o valor muda por fora (dados carregados,
  // formulário reiniciado), sem atropelar o que está sendo digitado.
  // Ajustado durante o render, e não num efeito, para não pintar o
  // valor antigo por um quadro.
  if (value !== syncedValue) {
    setSyncedValue(value);
    if (value && displayToIso(text) !== value) setText(isoToDisplay(value));
  }

  return (
    <Input
      {...shell}
      value={text}
      onChangeText={(raw) => {
        const masked = maskDate(raw);
        setText(masked);
        onChange(displayToIso(masked));
      }}
      placeholder="DD/MM/AAAA"
      keyboardType="number-pad"
      maxLength={10}
      disabled={disabled}
      hint={shell.hint ?? (text.length === 10 && !displayToIso(text) ? 'Data inexistente.' : undefined)}
    />
  );
}

// ---------------------------------------------------------------
// Seleção por chips (substitui o <select>)
// ---------------------------------------------------------------

interface ChipOption<T extends string> {
  value: T;
  label: string;
}

interface ChipSelectProps<T extends string> extends BaseFieldProps {
  options: readonly ChipOption<T>[];
  value: T | '';
  onChange: (value: T) => void;
  disabled?: boolean;
  /** Um chip por linha, para rótulos longos (perfil de acesso). */
  vertical?: boolean;
}

/**
 * Lista de opções tocáveis no lugar do `<select>`.
 *
 * Com até ~15 opções, ver todas de uma vez é mais rápido do que abrir
 * um seletor nativo e rolar — e funciona igual em todas as plataformas.
 */
export function ChipSelect<T extends string>({
  options,
  value,
  onChange,
  disabled,
  vertical,
  ...shell
}: ChipSelectProps<T>) {
  return (
    <FieldShell {...shell}>
      <ChipWrap $vertical={Boolean(vertical)}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Chip
              key={option.value}
              $selected={selected}
              $disabled={Boolean(disabled)}
              disabled={disabled}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled }}
            >
              <ChipText $selected={selected}>{option.label}</ChipText>
            </Chip>
          );
        })}
      </ChipWrap>
    </FieldShell>
  );
}

/** Agrupa campos curtos lado a lado (séries · repetições · carga). */
export function FieldRow({ children }: { children: ReactNode }) {
  // Cada campo em uma célula `flex: 1`: larguras iguais na linha. O
  // flex fica na célula e não no campo porque, dentro de ScrollView,
  // `flex: 1` numa pilha vertical zera a altura do elemento.
  return (
    <Row>
      {Children.map(children, (child) => (child ? <RowCell>{child}</RowCell> : null))}
    </Row>
  );
}

const FieldWrapper = styled.View`
  gap: ${space(2)};
`;

const FieldLabel = styled.Text`
  color: ${color('text')};
  font-size: ${font('sm')};
  font-weight: 600;
`;

const RequiredMark = styled.Text`
  color: ${color('danger')};
`;

const Hint = styled.Text`
  color: ${color('textSubtle')};
  font-size: ${font('xs')};
  line-height: 16px;
`;

const ErrorText = styled.Text`
  color: ${color('danger')};
  font-size: ${font('xs')};
  font-weight: 600;
  line-height: 16px;
`;

const Control = styled.TextInput<{ $invalid: boolean; $focused: boolean; $disabled: boolean }>`
  min-height: 48px;
  padding: ${space(3)} ${space(4)};
  border-radius: ${radius('md')};
  border-width: 1px;
  border-color: ${({ theme, $invalid, $focused }) =>
    $invalid ? theme.colors.danger : $focused ? theme.colors.accent : theme.colors.border};
  background-color: ${color('surface')};
  color: ${color('text')};
  font-size: ${font('base')};
  opacity: ${({ $disabled }) => ($disabled ? 0.6 : 1)};
`;

const ChipWrap = styled.View<{ $vertical: boolean }>`
  flex-direction: ${({ $vertical }) => ($vertical ? 'column' : 'row')};
  flex-wrap: wrap;
  gap: ${space(2)};
`;

export const Chip = styled.Pressable<{ $selected: boolean; $disabled?: boolean }>`
  flex-direction: row;
  align-items: center;
  gap: ${space(1)};
  padding: ${space(2)} ${space(3)};
  border-radius: ${radius('full')};
  border-width: 1px;
  border-color: ${({ theme, $selected }) => ($selected ? theme.colors.accent : theme.colors.border)};
  background-color: ${({ theme, $selected }) => ($selected ? theme.colors.accentSoft : theme.colors.surface)};
  opacity: ${({ $disabled }) => ($disabled ? 0.6 : 1)};
`;

export const ChipText = styled.Text<{ $selected: boolean }>`
  color: ${({ theme, $selected }) => ($selected ? theme.colors.accent : theme.colors.textMuted)};
  font-size: ${font('sm')};
  font-weight: 600;
`;

const Row = styled.View`
  flex-direction: row;
  gap: ${space(3)};
`;

const RowCell = styled.View`
  flex: 1;
`;

/** Pilha vertical de campos de um formulário. */
export const Form = styled.View`
  gap: ${space(4)};
`;
