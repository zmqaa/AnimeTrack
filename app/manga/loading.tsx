import PageContainer from '@/components/shared/PageContainer';
import { Skeleton } from '@/components/shared/Skeleton';

export default function MangaLoading() {
  return (
    <PageContainer as="main">
      <Skeleton className="h-56 rounded-[32px]" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-80 rounded-[26px]" />)}
      </div>
    </PageContainer>
  );
}
