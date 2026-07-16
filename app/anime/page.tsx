import { Suspense } from 'react';
import AnimePageClient from './AnimePageClient';
import PageContainer from '@/components/shared/PageContainer';

export default function AnimePage() {
  return (
    <Suspense fallback={<PageContainer as="main" width="wide" spacing="compact" animation="none"><div className="text-[var(--text-muted)]">Loading anime page...</div></PageContainer>}>
      <AnimePageClient />
    </Suspense>
  );
}
