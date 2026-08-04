import PageContainer from '@/components/shared/PageContainer';
import { Skeleton } from '@/components/shared/Skeleton';

export default function MangaDetailLoading() {
  return (
    <PageContainer as="main" width="content">
      <Skeleton className="h-52 rounded-[32px]" />
      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <Skeleton className="h-[460px] rounded-[28px]" />
        <Skeleton className="h-[720px] rounded-[28px]" />
      </div>
    </PageContainer>
  );
}

