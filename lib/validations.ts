import { z } from 'zod';
import { getAnimeDateOrderIssue, getMangaDateOrderIssue } from './date-validation';
import { isValidCalendarDate } from './date-utils';

const animeStatusSchema = z.enum(['watching', 'completed', 'dropped', 'plan_to_watch']);

const dateStringSchema = z.string()
  .refine(isValidCalendarDate, '日期必须是有效的 YYYY-MM-DD 公历日期')
  .optional()
  .nullable();

const stringArraySchema = z.array(z.string().max(200)).max(100).optional();
const coverUrlSchema = z.union([
  z.string().url().max(2000).refine((value) => /^https?:\/\//i.test(value), '封面地址必须使用 HTTP 或 HTTPS'),
  z.string().regex(/^\/(?:covers|api\/local-covers)\/\d+\.(?:jpg|jpeg|png|webp|gif)$/i, '无效的本地封面地址'),
  z.literal(''),
]).optional().nullable();

const animeFields = {
  title: z.string().min(1, '标题不能为空').max(500),
  originalTitle: z.string().max(500).optional().nullable(),
  coverUrl: coverUrlSchema,
  status: animeStatusSchema.default('plan_to_watch'),
  score: z.number().min(0).max(10).optional().nullable(),
  progress: z.number().int().min(0).default(0),
  totalEpisodes: z.number().int().min(0).max(9999).optional().nullable(),
  durationMinutes: z.number().int().min(0).max(9999).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  tags: stringArraySchema,
  cast: stringArraySchema,
  castAliases: stringArraySchema,
  summary: z.string().max(10000).optional().nullable(),
  startDate: dateStringSchema,
  endDate: dateStringSchema,
  premiereDate: dateStringSchema,
  isFinished: z.boolean().optional().nullable(),
};

function refineAnimeDateOrder(
  value: { startDate?: string | null; endDate?: string | null },
  context: z.RefinementCtx,
) {
  const issue = getAnimeDateOrderIssue(value);
  if (issue) context.addIssue({ code: 'custom', message: issue.message, path: [issue.field] });
}

export const createAnimeSchema = z.object(animeFields).superRefine(refineAnimeDateOrder);

// PATCH 字段必须保持真正可选，不能继承创建模型的默认值；否则只提交
// progressDelta 时也会被自动补出 progress=0，造成增量请求被误判为混合提交。
export const updateAnimeSchema = z.object(animeFields).partial().extend({
  status: animeStatusSchema.optional(),
  progress: z.number().int().min(0).optional(),
}).superRefine(refineAnimeDateOrder);

export const patchAnimeBodySchema = updateAnimeSchema.extend({
  progressDelta: z.union([z.literal(-1), z.literal(1)]).optional(),
  recordHistory: z.boolean().optional(),
  trimHistoryOnProgressDecrease: z.boolean().optional(),
}).superRefine((value, context) => {
  if (value.progressDelta !== undefined && value.progress !== undefined) {
    context.addIssue({
      code: 'custom',
      message: 'progress 与 progressDelta 不能同时提交',
      path: ['progressDelta'],
    });
  }

  if (value.progressDelta !== undefined) {
    const deltaControlKeys = new Set([
      'progressDelta',
      'recordHistory',
      'trimHistoryOnProgressDecrease',
    ]);
    const mixedField = Object.keys(value).find((key) => !deltaControlKeys.has(key));
    if (mixedField) {
      context.addIssue({
        code: 'custom',
        message: 'progressDelta 不能与其他番剧字段同时提交',
        path: [mixedField],
      });
    }
  }
});

export const animeNoteBodySchema = z.object({
  episode: z.number().int().min(1).max(9999),
  content: z.string().trim().min(1, '备注内容不能为空').max(5000),
  notedAt: z.string().refine(isValidCalendarDate, '备注日期必须是有效的 YYYY-MM-DD 公历日期'),
});

export const animeNoteCollectionSchema = z.array(animeNoteBodySchema).max(10000);

export type CreateAnimeInput = z.infer<typeof createAnimeSchema>;
export type UpdateAnimeInput = z.infer<typeof updateAnimeSchema>;

export const mangaReadingStatusSchema = z.enum([
  'plan_to_read', 'reading', 'caught_up', 'completed', 'paused', 'dropped',
]);

export const mangaPublicationStatusSchema = z.enum([
  'ongoing', 'completed', 'hiatus', 'unknown',
]);

const mangaPositionSchema = z.string().trim().max(100).optional().nullable();

const mangaFields = {
  bangumiId: z.number().int().positive().optional().nullable(),
  title: z.string().trim().min(1, '标题不能为空').max(500),
  originalTitle: z.string().trim().max(500).optional().nullable(),
  aliases: stringArraySchema,
  coverUrl: coverUrlSchema,
  status: mangaReadingStatusSchema.default('plan_to_read'),
  publicationStatus: mangaPublicationStatusSchema.default('unknown'),
  score: z.number().min(0).max(10).optional().nullable(),
  currentVolume: mangaPositionSchema,
  currentChapter: mangaPositionSchema,
  totalVolumes: z.number().int().min(0).max(9999).optional().nullable(),
  totalChapters: z.number().int().min(0).max(999999).optional().nullable(),
  notes: z.string().max(10000).optional().nullable(),
  tags: stringArraySchema,
  summary: z.string().max(10000).optional().nullable(),
  authors: stringArraySchema,
  illustrators: stringArraySchema,
  publishers: stringArraySchema,
  serializations: stringArraySchema,
  startDate: dateStringSchema,
  endDate: dateStringSchema,
  releaseDate: dateStringSchema,
};

function refineMangaDateOrder(
  value: { startDate?: string | null; endDate?: string | null },
  context: z.RefinementCtx,
) {
  const issue = getMangaDateOrderIssue(value);
  if (issue) context.addIssue({ code: 'custom', message: issue.message, path: [issue.field] });
}

export const createMangaSchema = z.object(mangaFields).superRefine(refineMangaDateOrder);

export const updateMangaSchema = z.object(mangaFields).partial().extend({
  status: mangaReadingStatusSchema.optional(),
  publicationStatus: mangaPublicationStatusSchema.optional(),
}).superRefine(refineMangaDateOrder);

export type CreateMangaInput = z.infer<typeof createMangaSchema>;
export type UpdateMangaInput = z.infer<typeof updateMangaSchema>;
