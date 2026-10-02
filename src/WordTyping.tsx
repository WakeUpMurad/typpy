import { InputBase } from '@mui/material';
import { useRef, type CSSProperties, type RefObject } from 'react';
import type { Mode } from './types';

interface WordTypingProps {
  text: string;
  mode: Mode;
  values: string[];
  onChange: (values: string[]) => void;
  onEnter: () => void;
  readOnly: boolean;
  firstInputRef: RefObject<HTMLInputElement | null>;
}

export function WordTyping({
  text,
  mode,
  values,
  onChange,
  onEnter,
  readOnly,
  firstInputRef,
}: WordTypingProps) {
  const words = text.trim().split(/\s+/);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  function focus(index: number, atEnd = false) {
    const input = inputs.current[Math.max(0, Math.min(index, words.length - 1))];
    input?.focus();
    if (atEnd && input) input.setSelectionRange(input.value.length, input.value.length);
  }

  function update(index: number, value: string) {
    const next = words.map((_, i) => values[i] || '');
    const parts = value.replace(/^\s+/, '').split(/\s+/);
    if (parts.length === 1) {
      next[index] = value;
      onChange(next);
      return;
    }
    const available = words.length - index;
    parts.slice(0, available).forEach((word, offset) => {
      next[index + offset] = word;
    });
    // Keep extra pasted words so an incorrect sentence is never silently accepted.
    if (parts.length > available)
      next[words.length - 1] = parts
        .slice(available - 1)
        .join(' ')
        .trimEnd();
    onChange(next);
    focus(Math.min(index + parts.length - 1, words.length - 1), true);
  }

  return (
    <div
      className={`word-typing mode-${mode}`}
      role="group"
      aria-label="Ввод предложения по словам"
    >
      {words.map((word, index) => {
        const value = values[index] || '';
        const matches =
          value.replace(/[’‘]/g, "'").toLowerCase() === word.replace(/[’‘]/g, "'").toLowerCase();
        const prompt = mode === 'hint' ? word[0] + '·'.repeat(word.length - 1) : word;
        return (
          <div
            key={index}
            className={`word-cell${value ? (matches ? ' word-correct' : ' word-entered') : ''}`}
            style={
              {
                '--word-width': `${mode === 'audio' ? 8 : Math.max(word.length + 1.5, 3.5)}ch`,
              } as CSSProperties
            }
          >
            {mode !== 'audio' && (
              <div className="word-prompt" aria-hidden="true">
                {[...prompt].map((character, position) => (
                  <span
                    key={position}
                    className={
                      mode === 'copy' && position < value.length
                        ? character.toLowerCase() === value[position]?.toLowerCase()
                          ? 'good'
                          : 'wrong'
                        : ''
                    }
                  >
                    {character}
                  </span>
                ))}
              </div>
            )}
            {mode === 'audio' && (
              <div className="word-position" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </div>
            )}
            <InputBase
              className="word-input"
              value={value}
              readOnly={readOnly}
              inputRef={(element: HTMLInputElement | null) => {
                inputs.current[index] = element;
                if (index === 0) firstInputRef.current = element;
              }}
              inputProps={{
                'aria-label': `Слово ${index + 1} из ${words.length}`,
                form: 'training-answer',
                spellCheck: false,
                autoComplete: 'off',
                autoCapitalize: 'off',
                autoCorrect: 'off',
              }}
              onChange={(event) => update(index, event.target.value)}
              onPaste={(event) => {
                if (readOnly) return;
                const pasted = event.clipboardData.getData('text');
                if (!/\s/.test(pasted)) return;
                event.preventDefault();
                update(index, pasted.trim());
              }}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing) return;
                const input = event.target as HTMLInputElement;
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onEnter();
                } else if (event.key === ' ' && !readOnly) {
                  event.preventDefault();
                  if (value.trim()) focus(index + 1);
                } else if (event.key === 'Backspace' && !value && index > 0) {
                  event.preventDefault();
                  focus(index - 1, true);
                } else if (
                  event.key === 'ArrowLeft' &&
                  input.selectionStart === 0 &&
                  input.selectionEnd === 0 &&
                  index > 0
                ) {
                  event.preventDefault();
                  focus(index - 1, true);
                } else if (
                  event.key === 'ArrowRight' &&
                  input.selectionStart === value.length &&
                  index < words.length - 1
                ) {
                  event.preventDefault();
                  focus(index + 1);
                }
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
