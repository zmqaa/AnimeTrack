import { apiError, apiSuccess, logApiInternalError, requireAdmin } from '@/lib/api-response';
import { lookupMangaTitle, type MangaLookupResult } from '@/lib/manga-lookup';

const MAX_TITLES = 10;
const MAX_TITLE_LENGTH = 200;

export async function POST(request: Request) {
  const auth = await requireAdmin('只有管理员可以查询漫画资料');
  if (!auth.authorized) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('请求内容必须是 JSON', 400);
  }

  const rawTitles = (body as { titles?: unknown } | null)?.titles;
  if (!Array.isArray(rawTitles)) {
    return apiError('titles 必须是漫画名称数组', 400);
  }

  const titles = Array.from(new Set(rawTitles
    .filter((title): title is string => typeof title === 'string')
    .map((title) => title.trim())
    .filter(Boolean)));
  if (titles.length === 0) return apiError('请至少提供一个漫画名称', 400);
  if (titles.length > MAX_TITLES) return apiError(`一次最多查询 ${MAX_TITLES} 个漫画名称`, 400);
  if (titles.some((title) => title.length > MAX_TITLE_LENGTH)) {
    return apiError(`漫画名称不能超过 ${MAX_TITLE_LENGTH} 个字符`, 400);
  }

  const results: MangaLookupResult[] = [];
  for (const [index, title] of titles.entries()) {
    try {
      results.push(await lookupMangaTitle(title));
    } catch (error) {
      logApiInternalError(error, '查询漫画外部资料', { itemIndex: index + 1 });
      results.push({
        input: title,
        selected: null,
        suggestion: null,
        confidence: null,
        method: 'none',
        needsConfirmation: false,
        reason: '漫画资料查询暂时失败，请稍后重试',
        candidates: [],
        warnings: ['本次查询失败，没有写入任何数据'],
      });
    }
  }

  return apiSuccess({ results });
}
