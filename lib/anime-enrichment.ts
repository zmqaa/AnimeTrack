import 'server-only';

import { enrichAnimeData, buildVoiceActorAliases } from './ai';
import { fetchAnimeMetadataByQueries } from './anime-provider';
import { uniqueStrings } from './anime-cast';
import type { CreateAnimeDTO } from './anime';
import { DEFAULT_METADATA_FIELDS, applyMetadataPatch, buildMetadataCandidate } from './metadata/merge-policy';
import {
  toOptionalString, toOptionalNumber, toOptionalBoolean, toOptionalDateString, toStringArray,
} from './ai-validation';

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
  let aiCandidate: MetadataSourceInput | null = null;
  let providerCandidate: MetadataSourceInput | null = null;

  // ── 第一步（并行）：AI 增强 + Provider 用原始标题搜索 ──
  const initialProviderQueries = [data.originalTitle, data.title, originalUserTitle]
    .map((item) => normalizeTitle(item))
    .filter((item): item is string => Boolean(item))
    .slice(0, providerQueryLimit);

  const [aiResult, initialProviderResult] = await Promise.allSettled([
    enrichAnimeData(originalUserTitle),
    initialProviderQueries.length > 0
      ? fetchAnimeMetadataByQueries(...initialProviderQueries)
      : Promise.resolve(null),
  ]);

  // 处理 AI 结果
  if (aiResult.status === 'fulfilled' && aiResult.value) {
    const enriched = aiResult.value;
    aiCandidate = sanitizeExternalCandidate({
      originalTitle: enriched.originalTitle,
      totalEpisodes: enriched.totalEpisodes,
      durationMinutes: enriched.durationMinutes,
      summary: enriched.synopsis,
      tags: enriched.tags,
      premiereDate: enriched.premiereDate,
      isFinished: enriched.isFinished,
      coverUrl: enriched.coverUrl,
    });

    const officialTitle = normalizeTitle(enriched.officialTitle);
    if ((mode === 'create' || mode === 'fill-missing') && officialTitle) {
      titleWasStandardized = officialTitle !== originalUserTitle;
      data.title = officialTitle;
    }
  } else if (aiResult.status === 'rejected') {
    console.error('AI enrichment failed:', aiResult.reason);
  }

  // 处理 Provider 第一轮结果
  if (initialProviderResult.status === 'fulfilled' && initialProviderResult.value) {
    providerCandidate = sanitizeExternalCandidate(initialProviderResult.value);
  } else if (initialProviderResult.status === 'rejected') {
    console.error('Provider metadata enrichment failed:', initialProviderResult.reason);
  }

  // ── 第二步（条件）：如果 AI 返回了更好的搜索词（原名），用原名再搜一次 ──
  const aiOriginalTitle = normalizeTitle(aiCandidate?.originalTitle as string);
  const hasBetterQuery = aiOriginalTitle && !initialProviderQueries.includes(aiOriginalTitle);

  if (hasBetterQuery && !providerCandidate) {
    // Provider 第一轮没命中，用 AI 原名重试
    try {
      const metadata = await fetchAnimeMetadataByQueries(aiOriginalTitle);
      if (metadata) {
        providerCandidate = sanitizeExternalCandidate(metadata);
      }
    } catch (error) {
      console.error('Provider retry with AI original title failed:', error);
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

  const mergedCandidate = buildMetadataCandidate(providerCandidate, aiCandidate);
  data = applyMetadataPatch(data, mergedCandidate, {
    fields: DEFAULT_METADATA_FIELDS,
    allowReplaceFilledCover: mode === 'create' && titleWasStandardized,
    allowCastAliasAugment: true,
    allowIsFinishedUpgrade: true,
  }).data as CreateAnimeDTO;

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
