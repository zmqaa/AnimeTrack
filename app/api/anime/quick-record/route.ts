import { NextRequest } from 'next/server';
import { createAnimeRecordWithHistory, updateAnimeRecord, CreateAnimeDTO, listAnimeRecordsByExactTitle, AnimeRecord } from '@/lib/anime';
import { parseQuickRecordBatch, type ParsedQuickRecordIntent } from '@/lib/ai';
import { enrichAnimeInput } from '@/lib/anime-enrichment';
import { apiError, apiSuccess, requireAdmin } from '@/lib/api-response';
import { resolveDisplayCoverUrl, resolveLocalCoverImage } from '@/lib/cover-image';
import {
  detectRewatchTag, resolveNextRewatchTag, validateSeasonSelection,
  mergeStringArrays, buildRecognition,
} from './_helpers';

type QuickRecordResult = {
  created: boolean;
  replay: boolean;
  rewatchTag?: string;
  historyWritten: boolean;
  parsed: ParsedQuickRecordIntent;
  recognition: ReturnType<typeof buildRecognition>;
  entry: AnimeRecord;
};

async function processQuickRecordIntent(
  parsedInput: ParsedQuickRecordIntent,
  options: { rawText: string; manualRewatchTag?: string; forceRewatch?: boolean },
): Promise<QuickRecordResult> {
  const parsed: ParsedQuickRecordIntent = {
    ...parsedInput,
    animeTitle: parsedInput.animeTitle.trim(),
    premiereDate: undefined,
  };

  validateSeasonSelection(options.rawText, parsed);

  let input: CreateAnimeDTO = {
    title: parsed.animeTitle,
    originalTitle: parsed.originalTitle,
    status: 'watching',
    progress: 0,
    startDate: undefined,
    endDate: undefined,
  };

  input = await enrichAnimeInput(input, {
    mode: 'create',
    // The recognized display title is the identity anchor.  The parsed original
    // title is still passed in `input` as an additional provider query, but it
    // must not replace the user's recognized work as the enrichment anchor.
    originalUserTitle: parsed.animeTitle,
    skipVoiceActorAliases: true,
    providerQueryLimit: 2,
    expectedSeason: parsed.season,
  });

  input.title = input.title.trim();
  if (!input.title) throw new Error('资料搜索未返回有效标题');

  const sameTitleRecords = await listAnimeRecordsByExactTitle(input.title);
  const explicitRewatchTag = parsed.rewatchTag
    || options.manualRewatchTag
    || detectRewatchTag(options.rawText)
    || (options.forceRewatch ? '二刷' : undefined);
  const rewatchTag = sameTitleRecords.length > 0
    ? resolveNextRewatchTag(sameTitleRecords)
    : explicitRewatchTag;

  if (rewatchTag) input.tags = mergeStringArrays(input.tags, [rewatchTag]);

  const metadataEnriched = Boolean(
    input.title !== parsed.animeTitle ||
    input.originalTitle || input.coverUrl || input.summary || input.totalEpisodes ||
    input.durationMinutes || (input.tags && input.tags.length > 0) ||
    (input.cast && input.cast.length > 0) || input.premiereDate ||
    input.isFinished !== undefined
  );
  const created = createAnimeRecordWithHistory(input);

  if (created.coverUrl) {
    const localCoverUrl = await resolveLocalCoverImage(created.coverUrl, created.id);
    await updateAnimeRecord(created.id, { localCoverUrl });
    created.localCoverUrl = localCoverUrl ?? undefined;
    created.displayCoverUrl = resolveDisplayCoverUrl(localCoverUrl, created.coverUrl);
  }

  return {
    created: true, replay: false, rewatchTag, historyWritten: false, parsed,
    recognition: buildRecognition(parsed, created, 0, metadataEnriched, false, undefined, 'watching'),
    entry: created,
  };
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin('只有管理员可以使用 AI 录入');
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    if (!text) {
      return apiError('请输入动漫名称', 400);
    }

    const parsedBatch = await parseQuickRecordBatch(text);
    if (!Array.isArray(parsedBatch.records) || parsedBatch.records.length === 0) {
      return apiError('未能识别番剧名称，请换一种说法', 400);
    }

    const manualRewatchTag = typeof body?.rewatchTag === 'string' ? body.rewatchTag.trim() : '';
    const results: QuickRecordResult[] = [];
    const errors: Array<{ title: string; error: string }> = [];

    for (const parsed of parsedBatch.records) {
      try {
        results.push(await processQuickRecordIntent(parsed, { rawText: text, manualRewatchTag, forceRewatch: Boolean(body?.forceRewatch) }));
      } catch (error) {
        errors.push({ title: parsed.animeTitle, error: error instanceof Error ? error.message : '处理失败' });
      }
    }

    if (results.length === 0) {
      return apiError(errors[0]?.error || 'AI 录入失败', 500, { errors });
    }

    const first = results[0];
    return apiSuccess({
      ok: true,
      count: results.length,
      createdCount: results.filter((r) => r.created).length,
      updatedCount: results.filter((r) => !r.created && !r.replay).length,
      replayCount: results.filter((r) => r.replay).length,
      historySkippedCount: 0,
      results, errors,
      created: first.created, replay: first.replay, rewatchTag: first.rewatchTag,
      parsed: first.parsed, recognition: first.recognition, entry: first.entry,
    });
  } catch (error: unknown) {
    console.error('Quick record error:', error);
    return apiError(error instanceof Error ? error.message : 'AI 录入失败', 500);
  }
}
