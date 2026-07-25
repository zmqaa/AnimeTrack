import { Suspense } from 'react';
import AdminPageClient from './AdminPageClient';
import { ManagementRouteSkeleton } from '@/components/shared/RouteSkeletons';

export default function AdminPage() {
  return (
    <Suspense fallback={<ManagementRouteSkeleton label="正在加载数据管理…" />}>
      <AdminPageClient />
    </Suspense>
  );
}
