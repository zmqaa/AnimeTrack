import { z } from 'zod';

const animeStatusSchema = z.enum(['watching', 'completed', 'dropped', 'plan_to_watch']);

const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式应为 YYYY-MM-DD').optional().nullable();

const stringArraySchema = z.array(z.string().max(200)).max(100).optional();
const coverUrlSchema = z.union([
  z.string().url().max(2000),
  z.string().regex(/^\/(?:covers|api\/local-covers)\/\d+\.(?:jpg|jpeg|png|webp|gif)$/i, '无效的本地封面地址'),
  z.literal(''),
]).optional().nullable();

export const createAnimeSchema = z.object({
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
});

// PATCH 字段必须保持真正可选，不能继承创建模型的默认值；否则只提交
// progressDelta 时也会被自动补出 progress=0，造成增量请求被误判为混合提交。
export const updateAnimeSchema = createAnimeSchema.partial().extend({
  status: animeStatusSchema.optional(),
  progress: z.number().int().min(0).optional(),
});

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

export type CreateAnimeInput = z.infer<typeof createAnimeSchema>;
export type UpdateAnimeInput = z.infer<typeof updateAnimeSchema>;
