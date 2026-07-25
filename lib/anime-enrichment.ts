import 'server-only';

import { buildVoiceActorAliases, selectAnimeMetadataCandidate } from './ai';
import { fetchAnimeMetadataBySubjectId, searchAnimeMetadataCandidatesByQueries } from './anime-provider';
import type { AnimeMetadataCandidate } from './anime-provider';
import { uniqueStrings } from './anime-cast';
import { extractSeasonNumber } from './chinese-parser';
import type { CreateAnimeDTO } from './anime';
import { DEFAULT_METADATA_FIELDS, applyMetadataPatch, buildMetadataCandidate } from './metadata/merge-policy';
import {
  toOptionalString, toOptionalNumber, toOptionalBoolean, toOptionalDateString, toStringArray,
} from './ai-validation';
import type { QuickRecordProgressReporter } from './quick-record-progress';

type MetadataSourceInput = Partial<CreateAnimeDTO> & {
  description?: string;
  synopsis?: string;
};

export type AnimeEnrichmentMode = 'create' | 'fill-missing';

export interface AnimeEnrichmentOptions {
  mode?: AnimeEnrichmentMode;
  originalUserTitle?: string;
  skipVoiceActorAliases?: boolean;
  providerQueryLimit?: number;
  expectedSeason?: number;
  reportProgress?: QuickRecordProgressReporter;
}

function normalizeTitle(value: string | undefined | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim();
  return normalized || undefined;
}

/** 清洗外部数据源（AI / Provider）返回值，防止脏数据入库 */
function sanitizeExternalCandidate(raw: MetadataSourceInput): MetadataSourceInput {
  return {
    ...raw,
    originalTitle: toOptionalString(raw.originalTitle)?.slice(0, 500),
    totalEpisodes: toOptionalNumber(raw.totalEpisodes),
    durationMinutes: toOptionalNumber(raw.durationMinutes),
    summary: toOptionalString(raw.summary ?? raw.description ?? raw.synopsis)?.slice(0, 10000),
    tags: toStringArray(raw.tags)?.map(t => t.slice(0, 100)).slice(0, 50),
    premiereDate: toOptionalDateString(raw.premiereDate),
    isFinished: toOptionalBoolean(raw.isFinished),
    coverUrl: toOptionalString(raw.coverUrl)?.slice(0, 2000),
  };
}

export async function enrichAnimeInput(input: CreateAnimeDTO, options: AnimeEnrichmentOptions = {}): Promise<CreateAnimeDTO> {
  const mode = options.mode || 'create';
  const originalUserTitle = (options.originalUserTitle || input.title || '').trim();
  const providerQueryLimit = Math.max(1, options.providerQueryLimit ?? 3);
  const expectedSeason = options.expectedSeason
    ?? extractSeasonNumber(input.title)
    ?? extractSeasonNumber(originalUserTitle);
  const report = options.reportProgress;

  let data: CreateAnimeDTO = {
    ...input,
    tags: input.tags ? [...input.tags] : undefined,
    cast: input.cast ? [...input.cast] : undefined,
    castAliases: input.castAliases ? [...input.castAliases] : undefined,
  };

  if (!originalUserTitle) {
    return data;
  }

  let titleWasStandardized = false;
  let providerCandidate: MetadataSourceInput | null = null;

  // ── 第一步：只用结构化识别标题/原名搜索 Bangumi 原始候选 ──
  const initialProviderQueries = [data.originalTitle, data.title, originalUserTitle]
    .map((item) => normalizeTitle(item))
    .filter((item): item is string => Boolean(item))
    .slice(0, providerQueryLimit);
  report?.({
    type: 'progress',
    stage: 'bangumi-search',
    status: 'running',
    message: '正在用识别标题搜索 Bangumi',
    items: initialProviderQueries,
  });

  let bangumiCandidates: AnimeMetadataCandidate[] = [];
  try {
    bangumiCandidates = initialProviderQueries.length > 0
      ? await searchAnimeMetadataCandidatesByQueries(initialProviderQueries)
      : [];
  } catch (error) {
    console.error('Bangumi candidate search failed:', error);
  }
  report?.({
    type: 'progress',
    stage: 'bangumi-candidates',
    status: bangumiCandidates.length > 0 ? 'success' : 'warning',
    message: bangumiCandidates.length > 0
      ? `Bangumi 返回 ${bangumiCandidates.length} 个候选`
      : 'Bangumi 没有返回候选',
    items: bangumiCandidates.map((candidate) => [
      `#${candidate.id}`,
      candidate.title,
      candidate.originalTitle && candidate.originalTitle !== candidate.title
        ? `/ ${candidate.originalTitle}`
        : '',
      candidate.season ? `· 第 ${candidate.season} 季` : '',
      candidate.premiereDate ? `· ${candidate.premiereDate}` : '',
    ].filter(Boolean).join(' ')),
  });

  // ── 第二步：AI 从 Bangumi 候选 ID 中做最终语义选择 ──
  try {
    const selected = await selectAnimeMetadataCandidate({
      userTitle: originalUserTitle,
      recognizedTitle: input.title,
      recognizedOriginalTitle: input.originalTitle,
      expectedSeason,
      candidates: bangumiCandidates,
      onProgress: (event) => {
        if (event.type === 'attempt') {
          report?.({
            type: 'progress',
            stage: 'candidate-selection',
            status: 'running',
            message: event.attempt === 1 ? 'AI 正在选择候选' : 'AI 未选中，正在进行最后一次重试',
          });
          return;
        }

        if (event.type === 'invalid-ai-selection') {
          report?.({
            type: 'progress',
            stage: 'candidate-selection',
            status: 'warning',
            message: event.selectedId
              ? `AI 返回了候选列表之外的 ID：${event.selectedId}`
              : `AI 第 ${event.attempt} 次没有选择候选`,
          });
          return;
        }

        if (event.type === 'selected') {
          report?.({
            type: 'progress',
            stage: 'candidate-selected',
            status: 'success',
            message: event.method === 'ai'
              ? `AI ${event.attempt === 1 ? '首次' : '重试'}选择了 #${event.candidate.id}`
              : `AI 两次未选中，本地严格匹配选择了 #${event.candidate.id}`,
            detail: `${event.candidate.title}${event.candidate.originalTitle ? ` / ${event.candidate.originalTitle}` : ''}`,
          });
          return;
        }

        report?.({
          type: 'progress',
          stage: 'candidate-selected',
          status: 'warning',
          message: 'AI 与本地严格匹配都没有选择候选',
        });
      },
    });
    if (selected) {
      report?.({
        type: 'progress',
        stage: 'metadata',
        status: 'running',
        message: `正在读取 Bangumi #${selected.id} 的详情和角色资料`,
      });
      const metadata = await fetchAnimeMetadataBySubjectId(selected.id);
      if (metadata) {
        providerCandidate = sanitizeExternalCandidate(metadata);
        report?.({
          type: 'progress',
          stage: 'metadata',
          status: 'success',
          message: 'Bangumi 详情读取完成',
          detail: metadata.title || selected.title,
          items: [
            metadata.originalTitle ? `原名：${metadata.originalTitle}` : '',
            metadata.premiereDate ? `首播：${metadata.premiereDate}` : '',
            metadata.totalEpisodes ? `集数：${metadata.totalEpisodes}` : '',
            metadata.tags?.length ? `标签：${metadata.tags.join('、')}` : '',
          ].filter(Boolean),
        });
        console.info('[anime-enrichment] AI selected Bangumi candidate', {
          inputTitle: input.title,
          selectedId: selected.id,
          selectedTitle: selected.title,
          selectedOriginalTitle: selected.originalTitle,
        });
      } else {
        report?.({
          type: 'progress',
          stage: 'metadata',
          status: 'warning',
          message: `Bangumi #${selected.id} 详情读取失败`,
        });
      }
    } else if (bangumiCandidates.length > 0) {
      console.warn('[anime-enrichment] AI did not select a Bangumi candidate', {
        inputTitle: input.title,
        candidateIds: bangumiCandidates.map((candidate) => candidate.id),
      });
      // 有候选但 AI 无法判断时宁可保留识别标题，不把未绑定真实条目
      // 的自由生成资料写入库中。
      data.title = input.title;
      titleWasStandardized = false;
    }
  } catch (error) {
    console.error('AI Bangumi candidate selection failed:', error);
    if (bangumiCandidates.length > 0) {
      data.title = input.title;
      titleWasStandardized = false;
    }
  }

  // 提取 Provider 标题
  if (providerCandidate) {
    const providerTitle = normalizeTitle((providerCandidate as Record<string, unknown>).title as string);
    if ((mode === 'create' || mode === 'fill-missing') && providerTitle && providerTitle !== data.title) {
      titleWasStandardized = titleWasStandardized || providerTitle !== originalUserTitle;
      data.title = providerTitle;
    }
  }

  const mergedCandidate = buildMetadataCandidate(providerCandidate, null);
  data = applyMetadataPatch(data, mergedCandidate, {
    fields: DEFAULT_METADATA_FIELDS,
    allowReplaceFilledCover: mode === 'create' && titleWasStandardized,
    allowCastAliasAugment: true,
    allowIsFinishedUpgrade: true,
  }).data as CreateAnimeDTO;
  report?.({
    type: 'progress',
    stage: 'metadata',
    status: 'success',
    message: providerCandidate ? '元数据已合并到待录入记录' : '没有合并 Bangumi 元数据，保留 AI 识别标题',
    detail: data.title,
  });

  if (!options.skipVoiceActorAliases && Array.isArray(data.cast) && data.cast.length > 0) {
    try {
      data.castAliases = await buildVoiceActorAliases(data.cast, data.castAliases || []);
    } catch (error) {
      console.error('Voice actor alias generation failed:', error);
      data.castAliases = uniqueStrings([...(data.castAliases || []), ...data.cast]);
    }
  } else if (Array.isArray(data.cast) && data.cast.length > 0) {
    data.castAliases = uniqueStrings([...(data.castAliases || []), ...data.cast]);
  }

  return data;
}
