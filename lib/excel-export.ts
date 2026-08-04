import 'server-only';

import ExcelJS from 'exceljs';
import type { AnimeRecord } from './anime';
import type { AnimeNoteEntry } from './anime-shared';
import type { WatchHistoryRecord } from './history';
import type { MangaRecord } from './manga';

type AnimeWithNotes = AnimeRecord & { noteEntries?: AnimeNoteEntry[] };

function joinValues(values?: string[]): string {
  return values?.join('、') || '';
}

function formatNotes(record: AnimeWithNotes): string {
  if (!record.noteEntries?.length) return record.notes || '';
  return record.noteEntries.map((note) => {
    const prefix = note.episode == null ? '总备注' : `第 ${note.episode} 集`;
    return `${prefix}（${note.notedAt}）：${note.content}`;
  }).join('\n');
}

function configureWorksheet(worksheet: ExcelJS.Worksheet) {
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: worksheet.columnCount },
  };
  const header = worksheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3F7661' } };
  header.alignment = { vertical: 'middle', horizontal: 'center' };
  header.height = 24;
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      row.height = 20;
      row.alignment = { vertical: 'middle', wrapText: false };
    }
  });
}

function addAnimeWorksheet(workbook: ExcelJS.Workbook, anime: AnimeWithNotes[]) {
  const sheet = workbook.addWorksheet('番剧信息');
  sheet.columns = [
    { header: 'ID', key: 'id', width: 10 },
    { header: '标题', key: 'title', width: 28 },
    { header: '原标题', key: 'originalTitle', width: 28 },
    { header: '状态', key: 'status', width: 16 },
    { header: '评分', key: 'score', width: 10 },
    { header: '进度', key: 'progress', width: 10 },
    { header: '总集数', key: 'totalEpisodes', width: 10 },
    { header: '单集时长（分钟）', key: 'durationMinutes', width: 16 },
    { header: '首播日期', key: 'premiereDate', width: 14 },
    { header: '开始日期', key: 'startDate', width: 14 },
    { header: '结束日期', key: 'endDate', width: 14 },
    { header: '标签', key: 'tags', width: 28 },
    { header: '声优', key: 'cast', width: 36 },
    { header: '简介', key: 'summary', width: 50 },
    { header: '备注与分集随记', key: 'notes', width: 50 },
    { header: '创建时间', key: 'createdAt', width: 22 },
    { header: '更新时间', key: 'updatedAt', width: 22 },
  ];
  for (const record of anime) {
    sheet.addRow({
      ...record,
      originalTitle: record.originalTitle || '',
      score: record.score ?? '',
      totalEpisodes: record.totalEpisodes ?? '',
      durationMinutes: record.durationMinutes ?? '',
      premiereDate: record.premiereDate || '',
      startDate: record.startDate || '',
      endDate: record.endDate || '',
      tags: joinValues(record.tags),
      cast: joinValues(record.cast),
      summary: record.summary || '',
      notes: formatNotes(record),
    });
  }
  configureWorksheet(sheet);
}

function addHistoryWorksheet(workbook: ExcelJS.Workbook, history: WatchHistoryRecord[]) {
  const sheet = workbook.addWorksheet('观看历史');
  sheet.columns = [
    { header: 'ID', key: 'id', width: 10 },
    { header: '番剧 ID', key: 'animeId', width: 12 },
    { header: '番剧名称', key: 'animeTitle', width: 32 },
    { header: '集数', key: 'episode', width: 10 },
    { header: '观看时间', key: 'watchedAt', width: 26 },
  ];
  history.forEach((record) => sheet.addRow(record));
  configureWorksheet(sheet);
}

function addMangaWorksheet(workbook: ExcelJS.Workbook, manga: MangaRecord[]) {
  const sheet = workbook.addWorksheet('漫画信息');
  sheet.columns = [
    { header: 'ID', key: 'id', width: 10 },
    { header: 'Bangumi ID', key: 'bangumiId', width: 14 },
    { header: '标题', key: 'title', width: 28 },
    { header: '原名', key: 'originalTitle', width: 28 },
    { header: '别名', key: 'aliases', width: 30 },
    { header: '阅读状态', key: 'status', width: 16 },
    { header: '连载状态', key: 'publicationStatus', width: 16 },
    { header: '评分', key: 'score', width: 10 },
    { header: '当前卷', key: 'currentVolume', width: 12 },
    { header: '当前话', key: 'currentChapter', width: 12 },
    { header: '参考卷数', key: 'totalVolumes', width: 12 },
    { header: '参考话数', key: 'totalChapters', width: 12 },
    { header: '作者', key: 'authors', width: 28 },
    { header: '作画', key: 'illustrators', width: 28 },
    { header: '出版社', key: 'publishers', width: 24 },
    { header: '连载平台', key: 'serializations', width: 24 },
    { header: '标签', key: 'tags', width: 28 },
    { header: '开始日期', key: 'startDate', width: 14 },
    { header: '读完日期', key: 'endDate', width: 14 },
    { header: '发行日期', key: 'releaseDate', width: 14 },
    { header: '简介', key: 'summary', width: 50 },
    { header: '笔记', key: 'notes', width: 50 },
    { header: '封面地址', key: 'coverUrl', width: 42 },
    { header: '创建时间', key: 'createdAt', width: 22 },
    { header: '更新时间', key: 'updatedAt', width: 22 },
  ];
  for (const record of manga) {
    sheet.addRow({
      ...record,
      bangumiId: record.bangumiId ?? '',
      originalTitle: record.originalTitle || '',
      aliases: joinValues(record.aliases),
      score: record.score ?? '',
      currentVolume: record.currentVolume || '',
      currentChapter: record.currentChapter || '',
      totalVolumes: record.totalVolumes ?? '',
      totalChapters: record.totalChapters ?? '',
      authors: joinValues(record.authors),
      illustrators: joinValues(record.illustrators),
      publishers: joinValues(record.publishers),
      serializations: joinValues(record.serializations),
      tags: joinValues(record.tags),
      startDate: record.startDate || '',
      endDate: record.endDate || '',
      releaseDate: record.releaseDate || '',
      summary: record.summary || '',
      notes: record.notes || '',
      coverUrl: record.coverUrl || '',
    });
  }
  configureWorksheet(sheet);
}

export async function buildExcelExport(options: {
  anime?: AnimeWithNotes[];
  history?: WatchHistoryRecord[];
  manga?: MangaRecord[];
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AnimeTrack';
  workbook.created = new Date();
  if (options.anime) {
    addAnimeWorksheet(workbook, options.anime);
    addHistoryWorksheet(workbook, options.history || []);
  }
  if (options.manga) addMangaWorksheet(workbook, options.manga);
  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}
