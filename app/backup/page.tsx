import { Suspense } from 'react';
import BackupPageClient from './BackupPageClient';

export default function BackupPage() {
  return (
    <Suspense fallback={<main className="p-6 text-[var(--text-muted)]">加载中...</main>}>
      <BackupPageClient />
    </Suspense>
  );
}
