import { Suspense } from 'react';
import BackupPageClient from './BackupPageClient';
import { ManagementRouteSkeleton } from '@/components/shared/RouteSkeletons';

export default function BackupPage() {
  return (
    <Suspense fallback={<ManagementRouteSkeleton label="正在加载备份与导出…" />}>
      <BackupPageClient />
    </Suspense>
  );
}
