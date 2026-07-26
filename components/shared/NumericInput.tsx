"use client";

import type { FocusEvent, InputHTMLAttributes } from 'react';

type NumericInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange' | 'inputMode' | 'min' | 'max' | 'step'
> & {
  value: string | number;
  onValueChange: (value: string) => void;
  min?: number;
  max?: number;
  allowDecimal?: boolean;
  selectOnFocus?: boolean;
};

export default function NumericInput({
  value,
  onValueChange,
  min,
  max,
  allowDecimal = false,
  selectOnFocus = false,
  onBlur,
  onFocus,
  ...props
}: NumericInputProps) {
  const pattern = allowDecimal ? /^\d*(?:\.\d*)?$/ : /^\d*$/;

  const normalizeValue = (event: FocusEvent<HTMLInputElement>) => {
    const rawValue = event.currentTarget.value;
    if (rawValue !== '') {
      const parsed = Number(rawValue);
      if (Number.isFinite(parsed)) {
        const normalized = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, parsed));
        onValueChange(String(normalized));
      }
    }
    onBlur?.(event);
  };

  return (
    <input
      {...props}
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      pattern={allowDecimal ? '[0-9]*[.]?[0-9]*' : '[0-9]*'}
      value={value}
      onChange={(event) => {
        if (pattern.test(event.target.value)) {
          onValueChange(event.target.value);
        }
      }}
      onBlur={normalizeValue}
      onFocus={(event) => {
        if (selectOnFocus) event.currentTarget.select();
        onFocus?.(event);
      }}
    />
  );
}
