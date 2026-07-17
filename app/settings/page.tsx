"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

import { fetchJson } from '@/lib/client-api';
import { useRuntimeAccess } from '@/hooks/useRuntimeAccess';

type AiSettingsResponse = {
  editable: boolean;
  source: 'desktop-settings' | 'environment';
  config: {
    provider: string;
    apiUrl: string;
    model: string;
    jsonFormat: boolean;
    disableThinking: boolean;
    hasApiKey: boolean;
    apiKeyPreview: string;
  };
};

export default function SettingsPage() {
  const router = useRouter();
  const { canManage, isLoading: accessLoading } = useRuntimeAccess();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [editable, setEditable] = useState(false);
  const [source, setSource] = useState<AiSettingsResponse['source']>('environment');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKeyPreview, setApiKeyPreview] = useState('');
  const [form, setForm] = useState({
    provider: 'openai-compatible',
    apiUrl: '',
    model: '',
    apiKey: '',
    jsonFormat: true,
    disableThinking: false,
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
        setEditable(data.editable);
        setSource(data.source);
        setHasApiKey(data.config.hasApiKey);
        setApiKeyPreview(data.config.apiKeyPreview);
        setForm((current) => ({
          ...current,
          provider: data.config.provider,
          apiUrl: data.config.apiUrl,
          model: data.config.model,
          jsonFormat: data.config.jsonFormat,
          disableThinking: data.config.disableThinking,
        }));
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : '加载 AI 设置失败'))
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [canManage]);

  const payload = () => ({
    provider: form.provider,
    apiUrl: form.apiUrl,
    model: form.model,
    apiKey: form.apiKey,
    jsonFormat: form.jsonFormat,
    disableThinking: form.disableThinking,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = await fetchJson<AiSettingsResponse & { success: true }>('/api/settings/ai', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload()),
      }, '保存 AI 设置失败');
      setSource(data.source);
      setHasApiKey(data.config.hasApiKey);
      setApiKeyPreview(data.config.apiKeyPreview);
      setForm((current) => ({ ...current, apiKey: '' }));
      toast.success('AI 设置已保存，后续请求立即生效');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存 AI 设置失败');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const result = await fetchJson<{ success: true; model: string; elapsedMs: number }>('/api/settings/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload()),
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
            {editable
              ? '配置桌面版使用的 OpenAI 兼容接口。设置保存在便携目录的 data/settings.json。'
              : 'Web 模式的 AI 配置由服务器环境变量管理，此页面仅显示当前生效配置。'}
          </p>
        </div>

        <section className="glass-panel space-y-5 rounded-3xl border border-[var(--border)] p-6 md:p-8">
          <div className="rounded-2xl bg-[var(--tag-bg)] px-4 py-3 text-sm text-[var(--text-secondary)]">
            配置来源：{source === 'desktop-settings' ? '桌面设置文件' : '服务器环境变量'}
          </div>

          <label className="block space-y-2">
            <span className="text-sm text-[var(--text-secondary)]">服务商标识</span>
            <input className={inputClass} disabled={!editable} value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value })} />
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-[var(--text-secondary)]">API URL</span>
            <input className={inputClass} disabled={!editable} value={form.apiUrl} onChange={(event) => setForm({ ...form, apiUrl: event.target.value })} placeholder="https://api.deepseek.com/chat/completions" />
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-[var(--text-secondary)]">模型名称</span>
            <input className={inputClass} disabled={!editable} value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} placeholder="deepseek-chat" />
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-[var(--text-secondary)]">
              API Key {hasApiKey ? `（当前：${apiKeyPreview}，留空则保留）` : ''}
            </span>
            <input className={inputClass} disabled={!editable} type="password" autoComplete="off" value={form.apiKey} onChange={(event) => setForm({ ...form, apiKey: event.target.value })} placeholder={hasApiKey ? '留空以保留现有密钥' : '请输入 API Key'} />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-3 rounded-2xl border border-[var(--border)] p-4 text-sm text-[var(--text-secondary)]">
              <input type="checkbox" disabled={!editable} checked={form.jsonFormat} onChange={(event) => setForm({ ...form, jsonFormat: event.target.checked })} />
              请求 JSON 输出格式
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-[var(--border)] p-4 text-sm text-[var(--text-secondary)]">
              <input type="checkbox" disabled={!editable} checked={form.disableThinking} onChange={(event) => setForm({ ...form, disableThinking: event.target.checked })} />
              禁用思考模式
            </label>
          </div>

          {editable && (
            <div className="flex flex-wrap gap-3 pt-2">
              <button onClick={handleSave} disabled={saving || testing} className="rounded-2xl bg-[var(--color-watching)] px-5 py-3 text-sm font-medium text-white transition-opacity disabled:opacity-50">
                {saving ? '保存中...' : '保存设置'}
              </button>
              <button onClick={handleTest} disabled={saving || testing} className="rounded-2xl border border-[var(--border)] px-5 py-3 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--tag-bg)] disabled:opacity-50">
                {testing ? '测试中...' : '测试连接'}
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
