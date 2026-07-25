import { Suspense } from 'react';
import AnimePageClient from './AnimePageClient';
import { AnimeListRouteSkeleton } from '@/components/shared/RouteSkeletons';

export default function AnimePage() {
  return (
    <Suspense fallback={<AnimeListRouteSkeleton />}>
      <AnimePageClient />
    </Suspense>
  );
}
