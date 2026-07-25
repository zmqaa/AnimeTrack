"use client";

import type { ButtonHTMLAttributes, ReactNode } from 'react';

type AsyncButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  busy: boolean;
  busyLabel: ReactNode;
};

export default function AsyncButton({
  busy,
  busyLabel,
  disabled,
  children,
  type = 'button',
  ...props
}: AsyncButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy}
    >
      {busy ? (
        <span className="inline-flex items-center justify-center gap-2">
          <span className="loading-spinner" aria-hidden="true" />
          <span>{busyLabel}</span>
        </span>
      ) : children}
    </button>
  );
}
