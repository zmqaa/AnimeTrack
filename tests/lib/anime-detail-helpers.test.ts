import { describe, expect, it } from 'vitest';

import {
  classifyAnimeDetailLoadError,
  shouldRetryAnimeDetailLoad,
} from '../../app/anime/[id]/anime-detail-helpers';
import { ApiRequestError } from '../../lib/client-api';

describe('anime detail load errors', () => {
  it.each([400, 404])('classifies HTTP %s as not found without automatic retry', (status) => {
    const error = new ApiRequestError('Not found', status);

    expect(classifyAnimeDetailLoadError(error).kind).toBe('not-found');
    expect(shouldRetryAnimeDetailLoad(error)).toBe(false);
  });

  it.each([401, 403])('classifies HTTP %s as a permission error without automatic retry', (status) => {
    const error = new ApiRequestError('Forbidden', status);

    expect(classifyAnimeDetailLoadError(error).kind).toBe('forbidden');
    expect(shouldRetryAnimeDetailLoad(error)).toBe(false);
  });

  it('classifies server and network failures as retryable', () => {
    const serverError = new ApiRequestError('服务暂时不可用', 503);
    const networkError = new TypeError('Failed to fetch');

    expect(classifyAnimeDetailLoadError(serverError)).toMatchObject({
      kind: 'unavailable',
      detail: '服务暂时不可用',
    });
    expect(shouldRetryAnimeDetailLoad(serverError)).toBe(true);
    expect(shouldRetryAnimeDetailLoad(networkError)).toBe(true);
  });
});
