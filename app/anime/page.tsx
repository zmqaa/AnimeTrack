import { Suspense } from 'react';
import AnimePageClient from './AnimePageClient';

export default function AnimePage() {
  return (
    <Suspense fallback={<main className="p-8 text-[var(--text-muted)]">Loading anime page...</main>}>
      <AnimePageClient />
    </Suspense>
  );
}
