"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

import { fetchJson } from '@/lib/client-api';
import { useManageAccess } from '@/hooks/useManageAccess';
import AsyncButton from '@/components/shared/AsyncButton';

type AiSettingsResponse = {
  source: 'environment';
  config: {
    apiUrl: string;
    model: string;
    hasApiKey: boolean;
    apiKeyPreview: string;
  };
};

export default function SettingsPage() {
  const router = useRouter();
  const { canManage, isLoading: accessLoading } = useManageAccess();
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKeyPreview, setApiKeyPreview] = useState('');
  const [config, setConfig] = useState({
    apiUrl: '',
    model: '',
  });

  useEffect(() => {
    if (!accessLoading && !canManage) router.replace('/');
  }, [accessLoading, canManage, router]);

  useEffect(() => {
    if (!canManage) return;
    let active = true;

    fetchJson<AiSettingsResponse>('/api/settings/ai', undefined, '加载 AI 设置失败')
      .then((data) => {
        if (!active) return;
        setHasApiKey(data.config.hasApiKey);
        setApiKeyPreview(data.config.apiKeyPreview);
        setConfig({
          apiUrl: data.config.apiUrl,
          model: data.config.model,
        });
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : '加载 AI 设置失败'))
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [canManage]);

  const handleTest = async () => {
    setTesting(true);
    try {
      const result = await fetchJson<{ success: true; model: string; elapsedMs: number }>('/api/settings/ai/test', {
        method: 'POST',
      }, 'AI 连接测试失败');
      toast.success(`连接成功：${result.model}，${result.elapsedMs} ms`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'AI 连接测试失败');
    } finally {
      setTesting(false);
    }
  };

  if (accessLoading || !canManage || loading) {
    return <main className="p-6 text-[var(--text-secondary)]">加载设置中...</main>;
  }

  const inputClass = 'w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-page)] px-4 py-3 text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--color-watching)] disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <main className="p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="font-display text-2xl tracking-tight text-[var(--text-primary)] md:text-3xl">AI 设置</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            AI 配置由服务器环境变量管理，此页面显示当前生效配置并可测试连接。
          </p>
        </div>

        <section className="glass-panel space-y-5 rounded-3xl border border-[var(--border)] p-6 md:p-8">
          <div className="rounded-2xl bg-[var(--tag-bg)] px-4 py-3 text-sm text-[var(--text-secondary)]">
            配置来源：服务器环境变量
          </div>

          <label className="block space-y-2">
            <span className="text-sm text-[var(--text-secondary)]">API URL</span>
            <input className={inputClass} disabled value={config.apiUrl} readOnly />
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-[var(--text-secondary)]">模型名称</span>
            <input className={inputClass} disabled value={config.model} readOnly />
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-[var(--text-secondary)]">
              API Key
            </span>
            <input className={inputClass} disabled value={hasApiKey ? apiKeyPreview : '未配置'} readOnly />
          </label>

          <div className="flex flex-wrap gap-3 pt-2">
            <AsyncButton
              onClick={handleTest}
              busy={testing}
              busyLabel="正在测试连接…"
              disabled={!hasApiKey}
              className="rounded-2xl border border-[var(--border)] px-5 py-3 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--tag-bg)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              测试连接
            </AsyncButton>
          </div>
        </section>
      </div>
    </main>
  );
}
