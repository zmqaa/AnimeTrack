import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../../lib/ai-runtime', () => ({
  createAiRuntimeConfig: vi.fn(() => ({ apiKey: '', apiUrl: '', model: '' })),
  requestAiJson: vi.fn(),
}));

import {
  findExactMangaCandidates,
  selectMangaCandidate,
} from '../../lib/manga-lookup';
import type { MangaMetadataCandidate } from '../../lib/manga-provider';
import { createAiRuntimeConfig, requestAiJson } from '../../lib/ai-runtime';

function candidate(
  id: number,
  title: string,
  overrides: Partial<MangaMetadataCandidate> = {},
): MangaMetadataCandidate {
  return {
    id,
    title,
    aliases: [],
    authors: [],
    illustrators: [],
    publishers: [],
    serializations: [],
    tags: [],
    detailLoaded: true,
    ...overrides,
  };
}

describe('漫画候选匹配', () => {
  beforeEach(() => {
    vi.mocked(createAiRuntimeConfig).mockReturnValue({ apiKey: '', apiUrl: '', model: '' });
    vi.mocked(requestAiJson).mockReset();
  });

  it('可以通过不同标点命中同一标题', () => {
    const match = candidate(298702, '请你回去吧！阿久津同学');
    expect(findExactMangaCandidates('请你回去吧，阿久津同学', [match])).toEqual([match]);
  });

  it('可以通过 Bangumi 别名命中非标准译名', async () => {
    const match = candidate(300763, '失声少女心想「她太过温柔」', {
      aliases: ['失语少女的女友温柔过了头'],
    });
    const result = await selectMangaCandidate('失语少女的女友温柔过了头', [match]);
    expect(result.selected).toBe(match);
    expect(result.method).toBe('exact-alias');
  });

  it('同名或别名冲突时不自动选中', async () => {
    const candidates = [
      candidate(223850, '小春日和'),
      candidate(168673, '小春日和。'),
      candidate(90569, '机械女仆', { aliases: ['小春日和'] }),
    ];
    const result = await selectMangaCandidate('小春日和', candidates);
    expect(result.selected).toBeNull();
    expect(result.needsConfirmation).toBe(true);
    expect(result.method).toBe('ambiguous');
  });

  it('AI 只能选择候选列表中的 ID', async () => {
    vi.mocked(createAiRuntimeConfig).mockReturnValue({ apiKey: 'configured', apiUrl: '', model: '' });
    vi.mocked(requestAiJson).mockResolvedValue({ selectedId: 999, confidence: 0.99, reason: '错误 ID' });
    const result = await selectMangaCandidate('另一个译名', [candidate(1, '真实候选')]);
    expect(result.selected).toBeNull();
    expect(result.suggestion).toBeNull();
  });
});

