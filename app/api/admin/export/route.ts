import { NextRequest, NextResponse } from 'next/server';
import { listAnimeRecords } from '@/lib/anime';
import { getAllWatchHistory } from '@/lib/history';
import { requireAdmin } from '@/lib/api-response';
import { buildExportFilename } from '@/lib/export-filename';
import { buildPortableExport } from '@/scripts/shared/portable_export';
import { listAllAnimeNotes } from '@/lib/anime-notes';
import { listMangaRecords } from '@/lib/manga';
import { buildExcelExport } from '@/lib/excel-export';

type ExportDataset = 'anime' | 'manga';

function parseDatasets(request: NextRequest): ExportDataset[] {
  const value = request.nextUrl.searchParams.get('datasets');
  if (!value) return ['anime', 'manga'];
  return Array.from(new Set(value.split(',').filter(
    (dataset): dataset is ExportDataset => dataset === 'anime' || dataset === 'manga',
  )));
}

/** GET — 将选中的动漫数据和漫画数据导出为 JSON 或 XLSX。 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin('需要管理员权限');
  if (!auth.authorized) return auth.response;

  const format = request.nextUrl.searchParams.get('format') || 'json';
  const datasets = parseDatasets(request);
  if (datasets.length === 0) {
    return NextResponse.json({ error: '请至少选择一类导出数据' }, { status: 400 });
  }
  if (format !== 'json' && format !== 'xlsx') {
    return NextResponse.json({ error: '不支持的导出格式' }, { status: 400 });
  }

  const includesAnime = datasets.includes('anime');
  const includesManga = datasets.includes('manga');
  const [anime, history, manga] = await Promise.all([
    includesAnime ? listAnimeRecords() : Promise.resolve([]),
    includesAnime ? getAllWatchHistory() : Promise.resolve([]),
    includesManga ? listMangaRecords() : Promise.resolve([]),
  ]);

  const notesByAnimeId = new Map<number, ReturnType<typeof listAllAnimeNotes>>();
  if (includesAnime) {
    for (const note of listAllAnimeNotes()) {
      const notes = notesByAnimeId.get(note.animeId) || [];
      notes.push(note);
      notesByAnimeId.set(note.animeId, notes);
    }
  }
  const animeWithNotes = anime.map((record) => ({
    ...record,
    noteEntries: notesByAnimeId.get(record.id) || [],
  }));

  if (format === 'xlsx') {
    const workbook = await buildExcelExport({
      anime: includesAnime ? animeWithNotes : undefined,
      history: includesAnime ? history : undefined,
      manga: includesManga ? manga : undefined,
    });
    return new NextResponse(new Uint8Array(workbook), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${buildExportFilename('xlsx')}"`,
      },
    });
  }

  const data = buildPortableExport(animeWithNotes, history, undefined, manga, datasets);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${buildExportFilename('json')}"`,
    },
  });
}
