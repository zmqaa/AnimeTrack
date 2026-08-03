import 'server-only';

import { createAiRuntimeConfig, requestAiJson } from './ai-runtime';
import { searchMangaMetadataCandidates, type MangaMetadataCandidate } from './manga-provider';

export type MangaLookupSelection = {
  selected: MangaMetadataCandidate | null;
  suggestion: MangaMetadataCandidate | null;
  confidence: number | null;
  method: 'exact-alias' | 'ai' | 'ambiguous' | 'none';
  needsConfirmation: boolean;
  reason: string;
};

export type MangaLookupResult = MangaLookupSelection & {
  input: string;
  candidates: MangaMetadataCandidate[];
  warnings: string[];
};

function normalizeTitle(value: string) {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '');
}

function candidateTitles(candidate: MangaMetadataCandidate) {
  return [candidate.title, candidate.originalTitle, ...candidate.aliases]
    .filter((value): value is string => Boolean(value));
}

export function findExactMangaCandidates(
  input: string,
  candidates: MangaMetadataCandidate[],
) {
  const normalizedInput = normalizeTitle(input);
  return candidates.filter((candidate) => candidateTitles(candidate)
    .some((title) => normalizeTitle(title) === normalizedInput));
}

async function askAiToSelectCandidate(
  input: string,
  candidates: MangaMetadataCandidate[],
): Promise<{ selectedId: number | null; confidence: number | null; reason: string } | null> {
  if (!createAiRuntimeConfig().apiKey || candidates.length === 0) return null;

  const response = await requestAiJson<Record<string, unknown>>({
    messages: [
      {
        role: 'system',
        content: '你是漫画数据库候选匹配助手。只能从给定的 Bangumi 真实候选中选择，不得创造条目。信息不足或同名歧义无法排除时必须返回 null。只输出 JSON。',
      },
      {
        role: 'user',
        content: `请判断用户输入对应哪一部具体漫画。\n\n用户输入：${input}\n\n候选：\n${JSON.stringify(candidates.map((candidate) => ({
          id: candidate.id,
          title: candidate.title,
          originalTitle: candidate.originalTitle || null,
          aliases: candidate.aliases,
          authors: candidate.authors,
          illustrators: candidate.illustrators,
          releaseDate: candidate.releaseDate || null,
          volumeCount: candidate.volumeCount || null,
          chapterCount: candidate.chapterCount || null,
          summary: candidate.summary?.slice(0, 300) || null,
        })), null, 2)}\n\n返回格式：\n{"selectedId": 123或null, "confidence": 0到1, "reason": "简短中文理由"}\n\n若多个候选都把该输入列为标题或别名，而用户没有提供作者、年代、人物或情节等区分信息，必须返回 selectedId: null。`,
      },
    ],
    temperature: 0,
    timeoutMs: 20_000,
    cache: 'no-store',
  });

  const selectedId = typeof response?.selectedId === 'number'
    ? response.selectedId
    : typeof response?.selectedId === 'string'
      ? Number(response.selectedId)
      : null;
  const confidence = typeof response?.confidence === 'number'
    ? Math.min(1, Math.max(0, response.confidence))
    : null;
  const reason = typeof response?.reason === 'string' && response.reason.trim()
    ? response.reason.trim().slice(0, 500)
    : 'AI 未提供选择理由';

  return {
    selectedId: selectedId && candidates.some((candidate) => candidate.id === selectedId)
      ? selectedId
      : null,
    confidence,
    reason,
  };
}

export async function selectMangaCandidate(
  input: string,
  candidates: MangaMetadataCandidate[],
): Promise<MangaLookupSelection> {
  if (candidates.length === 0) {
    return {
      selected: null,
      suggestion: null,
      confidence: null,
      method: 'none',
      needsConfirmation: false,
      reason: 'Bangumi 没有返回漫画候选',
    };
  }

  const exactMatches = findExactMangaCandidates(input, candidates);
  if (exactMatches.length === 1) {
    return {
      selected: exactMatches[0],
      suggestion: exactMatches[0],
      confidence: 1,
      method: 'exact-alias',
      needsConfirmation: false,
      reason: exactMatches[0].title === input ? '与 Bangumi 标题完全一致' : '命中 Bangumi 收录的译名或别名',
    };
  }

  const aiSelection = await askAiToSelectCandidate(input, candidates.slice(0, 10));
  const suggestion = aiSelection?.selectedId
    ? candidates.find((candidate) => candidate.id === aiSelection.selectedId) || null
    : null;

  if (exactMatches.length > 1) {
    return {
      selected: null,
      suggestion,
      confidence: aiSelection?.confidence ?? null,
      method: 'ambiguous',
      needsConfirmation: true,
      reason: aiSelection?.reason || `有 ${exactMatches.length} 个候选将该名称作为标题或别名，需要作者或封面等信息确认`,
    };
  }

  if (suggestion && (aiSelection?.confidence ?? 0) >= 0.75) {
    return {
      selected: suggestion,
      suggestion,
      confidence: aiSelection?.confidence ?? null,
      method: 'ai',
      needsConfirmation: false,
      reason: aiSelection?.reason || 'AI 根据真实候选完成了语义匹配',
    };
  }

  return {
    selected: null,
    suggestion,
    confidence: aiSelection?.confidence ?? null,
    method: aiSelection ? 'ai' : 'none',
    needsConfirmation: true,
    reason: aiSelection?.reason || '没有足够信息可靠选择候选',
  };
}

export async function lookupMangaTitle(input: string): Promise<MangaLookupResult> {
  const title = input.trim();
  const candidates = await searchMangaMetadataCandidates(title);
  const selection = await selectMangaCandidate(title, candidates);
  const warnings: string[] = [];

  if (candidates.some((candidate) => !candidate.detailLoaded)) {
    warnings.push('部分靠后候选未读取完整详情');
  }
  if (selection.needsConfirmation) {
    warnings.push('当前结果不会用于自动入库');
  }

  return { input: title, ...selection, candidates, warnings };
}

