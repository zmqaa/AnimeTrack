import { NextRequest } from 'next/server';
import { createAnimeRecordWithHistory, updateAnimeRecord, CreateAnimeDTO, listAnimeRecordsByExactTitle, AnimeRecord } from '@/lib/anime';
import {
  parseQuickRecordBatch,
  type ParsedQuickRecordIntent,
  type QuickRecordParseMethod,
} from '@/lib/ai';
import { enrichAnimeInput } from '@/lib/anime-enrichment';
import { apiError, apiInternalError, apiSuccess, logApiInternalError, requireAdmin } from '@/lib/api-response';
import { resolveDisplayCoverUrl, resolveLocalCoverImage, resolveThumbnailCoverUrl } from '@/lib/cover-image';
import type {
  QuickRecordProgressEvent,
  QuickRecordProgressReporter,
  QuickRecordStreamEvent,
} from '@/lib/quick-record-progress';
import {
  detectRewatchTag, resolveNextRewatchTag, validateSeasonSelection,
  mergeStringArrays, buildRecognition, QuickRecordValidationError,
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
  options: {
    rawText: string;
    manualRewatchTag?: string;
    forceRewatch?: boolean;
    reportProgress?: QuickRecordProgressReporter;
  },
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
    reportProgress: options.reportProgress,
  });

  input.title = input.title.trim();
  if (!input.title) throw new QuickRecordValidationError('资料搜索未返回有效标题');

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
  options.reportProgress?.({
    type: 'progress',
    stage: 'saving',
    status: 'running',
    message: '正在写入动漫记录',
    detail: input.title,
  });
  const created = createAnimeRecordWithHistory(input);
  options.reportProgress?.({
    type: 'progress',
    stage: 'saving',
    status: 'success',
    message: `记录已写入，ID 为 ${created.id}`,
    detail: created.title,
  });

  if (created.coverUrl) {
    options.reportProgress?.({
      type: 'progress',
      stage: 'cover',
      status: 'running',
      message: '正在缓存封面',
    });
    const localCoverUrl = await resolveLocalCoverImage(created.coverUrl, created.id);
    await updateAnimeRecord(created.id, { localCoverUrl });
    created.localCoverUrl = localCoverUrl ?? undefined;
    created.displayCoverUrl = resolveDisplayCoverUrl(localCoverUrl, created.coverUrl);
    created.thumbnailCoverUrl = resolveThumbnailCoverUrl(localCoverUrl, created.coverUrl);
    options.reportProgress?.({
      type: 'progress',
      stage: 'cover',
      status: localCoverUrl ? 'success' : 'warning',
      message: localCoverUrl ? '封面已缓存到本地' : '封面缓存失败，将继续使用远程地址',
    });
  }

  return {
    created: true, replay: false, rewatchTag, historyWritten: false, parsed,
    recognition: buildRecognition(parsed, created, 0, metadataEnriched, false, undefined, 'watching'),
    entry: created,
  };
}

type QuickRecordBody = {
  text?: unknown;
  rewatchTag?: unknown;
  forceRewatch?: unknown;
  stream?: unknown;
};

class QuickRecordRunError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errors?: Array<{ title: string; error: string }>,
  ) {
    super(message);
  }
}

async function runQuickRecord(
  body: QuickRecordBody,
  report?: QuickRecordProgressReporter,
) {
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) {
    throw new QuickRecordRunError('请输入动漫名称', 400);
  }

  report?.({
    type: 'progress',
    stage: 'received',
    status: 'success',
    message: '已收到录入内容',
    detail: text,
  });
  report?.({
    type: 'progress',
    stage: 'parsing',
    status: 'running',
    message: 'AI 正在识别标题与观看意图',
  });

  let parseMethod: QuickRecordParseMethod = 'ai';
  const parsedBatch = await parseQuickRecordBatch(text, {
    onResolved: (method) => {
      parseMethod = method;
    },
  });
  if (!Array.isArray(parsedBatch.records) || parsedBatch.records.length === 0) {
    throw new QuickRecordRunError('未能识别番剧名称，请换一种说法', 400);
  }
  report?.({
    type: 'progress',
    stage: 'parsed',
    status: parseMethod === 'ai' ? 'success' : 'warning',
    message: parseMethod === 'ai'
      ? `AI 识别出 ${parsedBatch.records.length} 条记录`
      : `AI 未返回有效结构，本地解析出 ${parsedBatch.records.length} 条记录`,
    items: parsedBatch.records.map((record) => [
      record.animeTitle,
      record.originalTitle ? `/ ${record.originalTitle}` : '',
      record.season ? `· 第 ${record.season} 季` : '',
      record.status ? `· ${record.status}` : '',
    ].filter(Boolean).join(' ')),
  });

  const manualRewatchTag = typeof body.rewatchTag === 'string' ? body.rewatchTag.trim() : '';
  const results: QuickRecordResult[] = [];
  const errors: Array<{ title: string; error: string }> = [];

  for (const [index, parsed] of parsedBatch.records.entries()) {
    const prefix = parsedBatch.records.length > 1 ? `[${index + 1}/${parsedBatch.records.length}] ` : '';
    report?.({
      type: 'progress',
      stage: 'record',
      status: 'running',
      message: `${prefix}开始处理「${parsed.animeTitle}」`,
    });
    const reportForRecord: QuickRecordProgressReporter | undefined = report
      ? (event) => report({
          ...event,
          message: `${prefix}${event.message}`,
        })
      : undefined;

    try {
      const result = await processQuickRecordIntent(parsed, {
        rawText: text,
        manualRewatchTag,
        forceRewatch: Boolean(body.forceRewatch),
        reportProgress: reportForRecord,
      });
      results.push(result);
      report?.({
        type: 'progress',
        stage: 'record-complete',
        status: 'success',
        message: `${prefix}「${result.entry.title}」处理完成`,
      });
    } catch (error) {
      const isValidationError = error instanceof QuickRecordValidationError;
      const message = isValidationError
        ? error.message
        : '录入这部动漫时发生内部错误，请稍后重试';
      if (!isValidationError) {
        logApiInternalError(error, '处理 AI 快速录入条目', { itemIndex: index + 1 });
      }
      errors.push({ title: parsed.animeTitle, error: message });
      report?.({
        type: 'progress',
        stage: 'record-complete',
        status: 'error',
        message: `${prefix}「${parsed.animeTitle}」处理失败`,
        detail: message,
      });
    }
  }

  if (results.length === 0) {
    throw new QuickRecordRunError(errors[0]?.error || 'AI 录入失败', 500, errors);
  }

  const first = results[0];
  const response = {
    ok: true,
    count: results.length,
    createdCount: results.filter((r) => r.created).length,
    updatedCount: results.filter((r) => !r.created && !r.replay).length,
    replayCount: results.filter((r) => r.replay).length,
    historySkippedCount: 0,
    results,
    errors,
    created: first.created,
    replay: first.replay,
    rewatchTag: first.rewatchTag,
    parsed: first.parsed,
    recognition: first.recognition,
    entry: first.entry,
  };
  report?.({
    type: 'progress',
    stage: 'complete',
    status: errors.length > 0 ? 'warning' : 'success',
    message: errors.length > 0
      ? `录入完成，成功 ${results.length} 条，失败 ${errors.length} 条`
      : `全部完成，共录入 ${results.length} 条`,
  });
  return response;
}

function createQuickRecordStream(body: QuickRecordBody): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: QuickRecordStreamEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        const result = await runQuickRecord(body, (event: QuickRecordProgressEvent) => send(event));
        send({ type: 'result', data: result });
      } catch (error) {
        const message = error instanceof QuickRecordRunError
          ? error.message
          : 'AI 录入失败，请稍后重试';
        if (!(error instanceof QuickRecordRunError)) {
          logApiInternalError(error, '执行 AI 流式快速录入');
        }
        send({
          type: 'error',
          error: message,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin('只有管理员可以使用 AI 录入');
  if (!auth.authorized) {
    return auth.response;
  }

  let body: QuickRecordBody;
  try {
    body = await request.json() as QuickRecordBody;
  } catch {
    return apiError('请求内容不是有效的 JSON', 400);
  }

  if (body.stream === true) {
    return createQuickRecordStream(body);
  }

  try {
    return apiSuccess(await runQuickRecord(body));
  } catch (error: unknown) {
    if (error instanceof QuickRecordRunError) {
      return apiError(error.message, error.status, error.errors ? { errors: error.errors } : undefined);
    }
    return apiInternalError(error, {
      operation: '执行 AI 快速录入',
      message: 'AI 录入失败，请稍后重试',
    });
  }
}
