"use client";

import { Toaster } from 'react-hot-toast';

export default function Toast() {
  return (
    <Toaster
      position="top-center"
      gutter={8}
      toastOptions={{
        duration: 3000,
        style: {
          background: 'var(--color-toast-bg)',
          backdropFilter: 'blur(20px)',
          color: 'var(--color-toast-text)',
          border: '1px solid var(--color-toast-border)',
          borderRadius: '16px',
          fontSize: '13px',
          padding: '12px 16px',
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.4)',
          maxWidth: '420px',
        },
        success: {
          iconTheme: {
            primary: 'var(--color-toast-success-icon)',
            secondary: 'var(--color-toast-icon-bg)',
          },
        },
        error: {
          iconTheme: {
            primary: 'var(--color-toast-error-icon)',
            secondary: 'var(--color-toast-icon-bg)',
          },
          duration: 4000,
        },
      }}
    />
  );
}
