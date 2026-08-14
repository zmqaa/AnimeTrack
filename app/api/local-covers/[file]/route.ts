import fs from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';

import { apiError, apiInternalError } from '@/lib/api-response';
import { getCoversDirectory } from '@/lib/runtime-paths';

const COVER_FILE_PATTERN = /^(?:\d+\.(?:jpg|jpeg|png|webp|gif)|\d+\.thumb\.webp)$/i;

export async function GET(
  request: Request,
  context: { params: Promise<{ file: string }> },
) {
  const { file: fileName } = await context.params;
  if (!COVER_FILE_PATTERN.test(fileName) || path.basename(fileName) !== fileName) {
    return apiError('无效的封面文件名', 'BAD_REQUEST');
  }

  const coversDirectory = path.resolve(getCoversDirectory());
  const filePath = path.resolve(coversDirectory, fileName);
  if (path.dirname(filePath) !== coversDirectory) {
    return apiError('无效的封面文件路径', 'BAD_REQUEST');
  }

  try {
    const content = await fs.readFile(filePath);
    const extension = path.extname(fileName).toLowerCase();
    const version = new URL(request.url).searchParams.get('v')?.trim();
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
        // 应用生成的展示 URL 会携带文件修改时间作为版本号。版本化地址可长期
        // 缓存；直接访问无版本地址时仅短暂缓存，避免封面替换后长期看到旧图。
        'Cache-Control': version
          ? 'public, max-age=31536000, immutable'
          : 'public, max-age=60, must-revalidate',
      },
    });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return apiError('封面不存在', 'NOT_FOUND');
    }
    return apiInternalError(error, {
      operation: '读取本地封面',
      message: '读取封面失败，请稍后重试',
      context: { fileName },
    });
  }
}
