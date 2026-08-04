import ExcelJS from 'exceljs';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

let buildExcelExport: typeof import('../../lib/excel-export').buildExcelExport;

beforeAll(async () => {
  ({ buildExcelExport } = await import('../../lib/excel-export'));
});

describe('Excel export', () => {
  it('creates two worksheets for the bundled anime data group', async () => {
    const buffer = await buildExcelExport({
      anime: [{
        id: 1,
        title: '测试番剧',
        status: 'watching',
        progress: 2,
        tags: ['日常'],
        createdAt: '2026-08-04T00:00:00.000Z',
        updatedAt: '2026-08-04T00:00:00.000Z',
      }],
      history: [{
        id: 1,
        animeId: 1,
        animeTitle: '测试番剧',
        episode: 2,
        watchedAt: '2026-08-04T00:00:00.000Z',
      }],
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['番剧信息', '观看历史']);
    expect(workbook.getWorksheet('番剧信息')?.getCell('B2').value).toBe('测试番剧');
    expect(workbook.getWorksheet('观看历史')?.getCell('C2').value).toBe('测试番剧');
    expect(workbook.getWorksheet('番剧信息')?.getRow(2).height).toBe(20);
    expect(workbook.getWorksheet('番剧信息')?.getRow(2).alignment?.wrapText).not.toBe(true);
  });

  it('creates only the manga worksheet for a manga-only export', async () => {
    const buffer = await buildExcelExport({
      manga: [{
        id: 1,
        title: '测试漫画',
        aliases: [],
        status: 'reading',
        publicationStatus: 'ongoing',
        tags: [],
        authors: [],
        illustrators: [],
        publishers: [],
        serializations: [],
        createdAt: '2026-08-04T00:00:00.000Z',
        updatedAt: '2026-08-04T00:00:00.000Z',
      }],
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['漫画信息']);
    expect(workbook.getWorksheet('漫画信息')?.getCell('C2').value).toBe('测试漫画');
    expect(workbook.getWorksheet('漫画信息')?.getRow(2).height).toBe(20);
  });
});
