import { Suspense } from 'react';
import AdminPageClient from './AdminPageClient';

export default function AdminPage() {
  return (
    <Suspense fallback={<main className="p-6 text-[var(--text-muted)]">加载中...</main>}>
      <AdminPageClient />
    </Suspense>
  );
}
