"use client";

import { useRef, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { mutate as globalMutate } from 'swr';
import toast from 'react-hot-toast';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { fetchBlob, fetchJson } from '@/lib/client-api';
import { buildExportFilename } from '@/lib/export-filename';
import { DASHBOARD_OVERVIEW_KEY, isHistoryKey, isTimelineKey } from '@/lib/swr-config';
import { useManageAccess } from '@/hooks/useManageAccess';
import AsyncButton from '@/components/shared/AsyncButton';

interface BackupFile {
  name: string;
  size: number;
  createdAt: string;
}

interface ImportResult {
  success: true;
  mode: 'replace';
  datasets: DataGroup[];
  anime: {
    selected: boolean;
    replaced: number;
  };
  watchHistory: {
    selected: boolean;
    replaced: number;
    skipped: number;
  };
  manga: {
    selected: boolean;
    replaced: number;
  };
}

interface RestoreResult {
  success: true;
  restored: string;
  animeCount: number;
  historyCount: number;
  mangaCount: number;
}

interface CoverBatchGroupResult {
  total: number;
  downloaded: number;
  skipped: number;
  failed: number;
}

interface CoverBatchResult extends CoverBatchGroupResult {
  anime: CoverBatchGroupResult;
  manga: CoverBatchGroupResult;
}

type DataGroup = 'anime' | 'manga';

type DataCounts = {
  animeCount: number;
  historyCount: number;
  mangaCount: number;
};

type PendingImport = {
  payload: Record<string, unknown>;
  availableDatasets: DataGroup[];
  selectedDatasets: DataGroup[];
  fileCounts: DataCounts;
  currentCounts: DataCounts;
};

export default function BackupPageClient() {
  const { canManage, isLoading: accessLoading } = useManageAccess();
  const router = useRouter();
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportDatasets, setExportDatasets] = useState<DataGroup[]>(['anime', 'manga']);
  const [importing, setImporting] = useState(false);
  const [downloadingCovers, setDownloadingCovers] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deletingBackup, setDeletingBackup] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);

  useEffect(() => {
    if (!accessLoading && !canManage) {
      router.replace('/');
    }
  }, [accessLoading, canManage, router]);

  const fetchBackups = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchJson<{ backups: BackupFile[] }>('/api/admin/backup', undefined, '加载备份列表失败');
      setBackups(data.backups);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '加载备份列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canManage) fetchBackups();
  }, [fetchBackups, canManage]);

  const handleCreateBackup = async () => {
    setCreating(true);
    try {
      await fetchJson<{ success: true }>('/api/admin/backup', { method: 'POST' }, '备份失败');
      toast.success('备份创建成功');
      fetchBackups();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '备份失败');
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = (name: string) => {
    window.open(`/api/admin/backup/download?file=${encodeURIComponent(name)}`, '_blank');
  };

  const handleDeleteBackup = async (name: string) => {
    if (deletingBackup) return;
    setDeletingBackup(true);
    try {
      await fetchJson<{ success: true }>('/api/admin/backup', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      }, '删除失败');
      toast.success('已删除备份');
      fetchBackups();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败');
    } finally {
      setDeletingBackup(false);
      setDeleteConfirm(null);
    }
  };

  const handleExport = async (format: 'json' | 'xlsx') => {
    if (exportDatasets.length === 0) return;
    setExporting(format);
    try {
      const params = new URLSearchParams({ format, datasets: exportDatasets.join(',') });
      const blob = await fetchBlob(`/api/admin/export?${params}`, undefined, '导出失败');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = buildExportFilename(format);
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${format.toUpperCase()} 导出成功`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '导出失败');
    } finally {
      setExporting(null);
    }
  };

  const toggleExportDataset = (dataset: DataGroup) => {
    setExportDatasets((current) => current.includes(dataset)
      ? current.filter((item) => item !== dataset)
      : [...current, dataset]);
  };

  const handleImportClick = () => {
    if (importing) {
      return;
    }

    importInputRef.current?.click();
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith('.json')) {
      toast.error('请选择 JSON 文件');
      return;
    }

    try {
      const text = await file.text();
      const payload = JSON.parse(text) as Record<string, unknown> & {
        datasets?: unknown;
        records?: unknown[];
        anime?: { records?: unknown[] };
        watchHistory?: { records?: unknown[] };
        manga?: { records?: unknown[] };
      };
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('导入文件格式无效');
      }
      const animeRecords = Array.isArray(payload?.anime?.records)
        ? payload.anime.records
        : (Array.isArray(payload?.records) ? payload.records : []);
      const historyRecords = Array.isArray(payload?.watchHistory?.records)
        ? payload.watchHistory.records
        : [];
      const mangaRecords = Array.isArray(payload?.manga?.records)
        ? payload.manga.records
        : [];
      const declaredDatasets = Array.isArray(payload.datasets)
        ? payload.datasets.filter((dataset): dataset is DataGroup => dataset === 'anime' || dataset === 'manga')
        : [];
      const availableDatasets = declaredDatasets.length > 0
        ? Array.from(new Set(declaredDatasets))
        : [
          ...(Object.prototype.hasOwnProperty.call(payload, 'anime')
            || Object.prototype.hasOwnProperty.call(payload, 'watchHistory')
            || Array.isArray(payload.records) ? ['anime' as const] : []),
          ...(Object.prototype.hasOwnProperty.call(payload, 'manga') ? ['manga' as const] : []),
        ];
      if (availableDatasets.length === 0) {
        throw new Error('导入文件中没有可识别的动漫或漫画数据');
      }
      const current = await fetchJson<{ anime: number; watchHistory: number; manga: number }>(
        '/api/admin/import', undefined, '读取当前数据数量失败',
      );
      setPendingImport({
        payload,
        availableDatasets,
        selectedDatasets: [...availableDatasets],
        fileCounts: { animeCount: animeRecords.length, historyCount: historyRecords.length, mangaCount: mangaRecords.length },
        currentCounts: { animeCount: current.anime, historyCount: current.watchHistory, mangaCount: current.manga },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '读取导入文件失败');
    }
  };

  const handleDownloadCovers = async () => {
    if (downloadingCovers) return;

    setDownloadingCovers(true);
    try {
      const result = await fetchJson<CoverBatchResult>('/api/admin/covers/download', {
        method: 'POST',
      }, '批量下载封面失败');
      if (result.total === 0) {
        toast('还没有动漫或漫画记录');
      } else if (result.downloaded === 0 && result.failed === 0) {
        toast.success('动漫和漫画封面都已缓存到本地');
      } else {
        const describe = (label: string, value: CoverBatchGroupResult) => (
          `${label}新下载 ${value.downloaded} 张、已有 ${value.skipped} 张、失败 ${value.failed} 张`
        );
        toast.success(`封面缓存完成：${describe('动漫', result.anime)}；${describe('漫画', result.manga)}`);
      }
      await globalMutate((key) => typeof key === 'string' && (
        key.startsWith('/api/anime') || key.startsWith('/api/manga')
      ));
      globalMutate(DASHBOARD_OVERVIEW_KEY);
      globalMutate(isTimelineKey);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '批量下载封面失败');
    } finally {
      setDownloadingCovers(false);
    }
  };

  const handleRestoreBackup = async (name: string) => {
    if (restoring) return;

    setRestoring(name);
    try {
      const result = await fetchJson<RestoreResult>('/api/admin/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      }, '恢复备份失败');

      toast.success(`恢复完成：${result.animeCount} 部番剧，${result.mangaCount} 部漫画，${result.historyCount} 条观看历史`);
      await Promise.all([
        globalMutate((key) => typeof key === 'string' && (
          key === DASHBOARD_OVERVIEW_KEY ||
          key.startsWith('/api/anime') ||
          key.startsWith('/api/history') ||
          key.startsWith('/api/timeline/') ||
          key.startsWith('/api/admin/anime') ||
          key.startsWith('/api/admin/history')
          || key.startsWith('/api/manga')
        )),
        fetchBackups(),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '恢复备份失败');
    } finally {
      setRestoring(null);
      setRestoreConfirm(null);
    }
  };

  const handleConfirmImport = async () => {
    if (!pendingImport || importing || pendingImport.selectedDatasets.length === 0) return;

    setImporting(true);
    try {
      const result = await fetchJson<ImportResult>('/api/admin/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...pendingImport.payload, selectedDatasets: pendingImport.selectedDatasets }),
      }, '导入失败');

      const summaries = [];
      if (result.anime.selected) summaries.push(`${result.anime.replaced} 部番剧、${result.watchHistory.replaced} 条历史`);
      if (result.manga.selected) summaries.push(`${result.manga.replaced} 部漫画`);
      toast.success(`覆盖完成：${summaries.join('；')}${result.watchHistory.skipped ? `，跳过 ${result.watchHistory.skipped} 条无法匹配的历史` : ''}`);
      // 全局刷新缓存：番剧列表 + Dashboard 数据同步更新
      await globalMutate((key) => typeof key === 'string' && key.startsWith('/api/anime'));
      await globalMutate((key) => typeof key === 'string' && key.startsWith('/api/manga'));
      globalMutate(DASHBOARD_OVERVIEW_KEY);
      globalMutate(isHistoryKey);
      globalMutate(isTimelineKey);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '导入失败');
    } finally {
      setImporting(false);
      setPendingImport(null);
    }
  };

  const toggleImportDataset = (dataset: DataGroup) => {
    setPendingImport((current) => {
      if (!current || !current.availableDatasets.includes(dataset)) return current;
      const selectedDatasets = current.selectedDatasets.includes(dataset)
        ? current.selectedDatasets.filter((item) => item !== dataset)
        : [...current.selectedDatasets, dataset];
      return { ...current, selectedDatasets };
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  };

  if (accessLoading || !canManage) {
    return <main className="p-6 text-[var(--text-secondary)]">验证权限中...</main>;
  }

  return (
    <main className="p-4 md:p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-display tracking-tight text-[var(--text-primary)]">备份与导出</h1>
        <p className="text-base text-[var(--text-muted)] mt-2">导出可迁移文件，或管理当前运行环境保存的 JSON 备份</p>
      </div>

      {/* Export Section */}
      <section className="glass-panel rounded-3xl border border-[var(--border)] p-6 md:p-8">
        <h2 className="text-lg font-medium text-[var(--text-primary)] mb-2">导出数据</h2>
        <p className="text-sm text-[var(--text-muted)] mb-5">
          自由选择动漫数据和漫画数据。动漫数据始终包含番剧信息、备注与观看历史；Excel 会将番剧信息和观看历史分别放在两个工作表中。
        </p>
        <div className="surface-card-muted mb-5 grid gap-3 rounded-2xl p-4 sm:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl p-2 transition-colors hover:bg-[var(--color-surface-hover)]">
            <input
              type="checkbox"
              checked={exportDatasets.includes('anime')}
              onChange={() => toggleExportDataset('anime')}
              className="mt-1 h-4 w-4 accent-[var(--accent)]"
            />
            <span>
              <span className="block text-sm font-medium text-[var(--text-primary)]">动漫数据</span>
              <span className="mt-1 block text-xs text-[var(--text-muted)]">番剧信息、备注和观看历史</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl p-2 transition-colors hover:bg-[var(--color-surface-hover)]">
            <input
              type="checkbox"
              checked={exportDatasets.includes('manga')}
              onChange={() => toggleExportDataset('manga')}
              className="mt-1 h-4 w-4 accent-[var(--accent)]"
            />
            <span>
              <span className="block text-sm font-medium text-[var(--text-primary)]">漫画数据</span>
              <span className="mt-1 block text-xs text-[var(--text-muted)]">漫画资料、阅读状态和进度</span>
            </span>
          </label>
        </div>
        <div className="flex flex-wrap gap-3">
          <AsyncButton
            onClick={() => handleExport('xlsx')}
            busy={exporting === 'xlsx'}
            busyLabel="正在导出 Excel…"
            disabled={exporting !== null || exportDatasets.length === 0}
            className="theme-accent-soft flex items-center gap-2.5 rounded-2xl px-5 py-3 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            导出 Excel
          </AsyncButton>
          <AsyncButton
            onClick={() => handleExport('json')}
            busy={exporting === 'json'}
            busyLabel="正在导出 JSON…"
            disabled={exporting !== null || exportDatasets.length === 0}
            className="theme-accent-soft flex items-center gap-2.5 rounded-2xl px-5 py-3 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            导出 JSON
          </AsyncButton>
          <AsyncButton
            onClick={handleImportClick}
            busy={importing}
            busyLabel="正在导入…"
            className="theme-accent-soft flex items-center gap-2.5 rounded-2xl px-5 py-3 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 20V10m0 0l-4 4m4-4l4 4M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1" />
            </svg>
            导入 JSON
          </AsyncButton>
          <AsyncButton
            onClick={handleDownloadCovers}
            busy={downloadingCovers}
            busyLabel="正在下载封面…"
            disabled={importing}
            className="theme-accent-soft flex items-center gap-2.5 rounded-2xl px-5 py-3 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            批量下载封面
          </AsyncButton>
        </div>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleImportFile}
        />
        <p className="text-xs text-[var(--text-muted)] mt-4">
          只有 JSON 可以回导。上传后可再次选择覆盖动漫数据、漫画数据或两者；文件未包含或没有勾选的数据不会改动。导入前会先在当前运行环境创建 JSON 安全备份。覆盖数据会清空对应的旧本地封面，之后可用“批量下载封面”重新缓存。
        </p>
      </section>

      {/* Backup Section */}
      <section className="glass-panel rounded-3xl border border-[var(--border)] p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
          <h2 className="text-lg font-medium text-[var(--text-primary)]">应用 JSON 备份</h2>
          <AsyncButton
            onClick={handleCreateBackup}
            busy={creating}
            busyLabel="正在创建备份…"
            className="theme-accent-button flex w-fit items-center gap-2.5 rounded-2xl px-5 py-3 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            立即创建备份
          </AsyncButton>
        </div>
        <p className="text-sm text-[var(--text-muted)] mb-6">
          完整备份包含动漫、备注、观看历史和漫画，不包含管理员账号和本地封面文件。当前服务器每天 03:20 自动生成并默认保留最近 10 份；本地运行时文件保存在本机，自动执行需要另行配置定时任务。恢复前会先保存当前状态。
        </p>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-[var(--border)] rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : backups.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-muted)]">
            暂无 JSON 备份，点击「立即创建备份」创建第一个
          </div>
        ) : (
          <div className="space-y-2">
            {backups.map((backup) => (
              <div
                key={backup.name}
                className="surface-card-muted flex items-center justify-between px-5 py-4 rounded-2xl hover:bg-[var(--color-surface-hover)] transition-all group"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm md:text-base text-[var(--text-secondary)] truncate font-medium">{backup.name}</p>
                  <p className="text-xs md:text-sm text-[var(--text-muted)] mt-1">
                    {formatDate(backup.createdAt)} · {formatSize(backup.size)}
                  </p>
                </div>
                <div className="flex items-center gap-1 ml-4 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDownload(backup.name)}
                    disabled={restoring !== null}
                    className="p-2.5 rounded-xl text-[var(--text-secondary)] hover:text-[var(--color-watching)] hover:bg-[var(--color-watching)]/10 transition-all"
                    title="下载"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRestoreConfirm(backup.name)}
                    disabled={restoring !== null}
                    aria-busy={restoring === backup.name}
                    className="p-2.5 rounded-xl text-[var(--text-secondary)] transition-all hover:bg-[var(--accent-light)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
                    title={restoring === backup.name ? '恢复中...' : '恢复'}
                  >
                    <svg className={`w-5 h-5 ${restoring === backup.name ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.023 9.348h4.992V4.356m-.62 4.37A9 9 0 105.64 18.36M7.977 14.652H2.985v4.992m.62-4.37A9 9 0 0018.36 5.64" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(backup.name)}
                    disabled={restoring !== null}
                    className="p-2.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-all"
                    title="删除"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={pendingImport !== null}
        title="选择要覆盖的数据"
        message="勾选的数据会被文件内容完整替换，未勾选的数据保持不变。空数据也会清空对应分组。"
        confirmText={importing ? '导入中...' : '确认覆盖'}
        variant="danger"
        busy={importing}
        confirmDisabled={!pendingImport || pendingImport.selectedDatasets.length === 0}
        onConfirm={handleConfirmImport}
        onCancel={() => !importing && setPendingImport(null)}
      >
        {pendingImport && (
          <div className="space-y-3">
            {pendingImport.availableDatasets.includes('anime') && (
              <label className="surface-card-muted flex cursor-pointer items-start gap-3 rounded-xl p-3 text-left">
                <input
                  type="checkbox"
                  checked={pendingImport.selectedDatasets.includes('anime')}
                  onChange={() => toggleImportDataset('anime')}
                  disabled={importing}
                  className="mt-1 h-4 w-4 accent-[var(--accent)]"
                />
                <span className="min-w-0 text-sm">
                  <span className="block font-medium text-[var(--text-primary)]">动漫数据</span>
                  <span className="mt-1 block text-xs text-[var(--text-muted)]">
                    当前 {pendingImport.currentCounts.animeCount} 部 / {pendingImport.currentCounts.historyCount} 条历史
                    {' → '}文件 {pendingImport.fileCounts.animeCount} 部 / {pendingImport.fileCounts.historyCount} 条历史
                  </span>
                </span>
              </label>
            )}
            {pendingImport.availableDatasets.includes('manga') && (
              <label className="surface-card-muted flex cursor-pointer items-start gap-3 rounded-xl p-3 text-left">
                <input
                  type="checkbox"
                  checked={pendingImport.selectedDatasets.includes('manga')}
                  onChange={() => toggleImportDataset('manga')}
                  disabled={importing}
                  className="mt-1 h-4 w-4 accent-[var(--accent)]"
                />
                <span className="min-w-0 text-sm">
                  <span className="block font-medium text-[var(--text-primary)]">漫画数据</span>
                  <span className="mt-1 block text-xs text-[var(--text-muted)]">
                    当前 {pendingImport.currentCounts.mangaCount} 部 → 文件 {pendingImport.fileCounts.mangaCount} 部
                  </span>
                </span>
              </label>
            )}
          </div>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={restoreConfirm !== null}
        title="恢复应用 JSON 备份"
        message={`确定恢复到「${restoreConfirm || ''}」吗？当前番剧、漫画、观看历史和本地封面会被替换；系统会先自动创建一份“恢复前备份”。`}
        confirmText={restoring ? '恢复中...' : '确认恢复'}
        variant="warning"
        busy={restoring !== null}
        onConfirm={() => restoreConfirm && handleRestoreBackup(restoreConfirm)}
        onCancel={() => !restoring && setRestoreConfirm(null)}
      />

      <ConfirmDialog
        open={deleteConfirm !== null}
        title="删除备份"
        message={`确定要删除备份文件 ${deleteConfirm} 吗？`}
        confirmText={deletingBackup ? '正在删除…' : '删除'}
        variant="danger"
        busy={deletingBackup}
        onConfirm={() => deleteConfirm && handleDeleteBackup(deleteConfirm)}
        onCancel={() => !deletingBackup && setDeleteConfirm(null)}
      />
    </main>
  );
}
