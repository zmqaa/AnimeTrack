import fs from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';

import { apiError } from '@/lib/api-response';
import { getCoversDirectory } from '@/lib/runtime-paths';

const COVER_FILE_PATTERN = /^\d+\.(?:jpg|jpeg|png|webp|gif)$/i;

export async function GET(
  _request: Request,
  context: { params: { file: string } },
) {
  const fileName = context.params.file;
  if (!COVER_FILE_PATTERN.test(fileName) || path.basename(fileName) !== fileName) {
    return apiError('无效的封面文件名', 400);
  }

  const coversDirectory = path.resolve(getCoversDirectory());
  const filePath = path.resolve(coversDirectory, fileName);
  if (path.dirname(filePath) !== coversDirectory) {
    return apiError('无效的封面文件路径', 400);
  }

  try {
    const content = await fs.readFile(filePath);
    const extension = path.extname(fileName).toLowerCase();
    const contentType = extension === '.png'
      ? 'image/png'
      : extension === '.webp'
        ? 'image/webp'
        : extension === '.gif'
          ? 'image/gif'
          : 'image/jpeg';

    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return apiError('封面不存在', 404);
    }
    return apiError('读取封面失败', 500);
  }
}
