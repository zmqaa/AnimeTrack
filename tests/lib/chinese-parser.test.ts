import { describe, expect, it } from 'vitest';

import {
  appendSeasonToTitle,
  extractSeasonNumber,
  normalizeTitleToken,
  parseChineseNumberToken,
  stripSeasonToken,
  toChineseNumberToken,
} from '../../lib/chinese-parser';

describe('Chinese number parsing', () => {
  it.each([
    ['一', 1],
    ['十二', 12],
    ['二十三', 23],
    ['一百零二', 102],
    ['12', 12],
  ])('parses %s as %i', (token, expected) => {
    expect(parseChineseNumberToken(token)).toBe(expected);
  });

  it.each(['', '零', '0', '十猫'])('rejects invalid or non-positive token %j', (token) => {
    expect(parseChineseNumberToken(token)).toBeUndefined();
  });

  it.each([
    [1, '一'],
    [12, '十二'],
    [23, '二十三'],
    [100, '100'],
  ])('formats %i as %s', (value, expected) => {
    expect(toChineseNumberToken(value)).toBe(expected);
  });
});

describe('Anime season title helpers', () => {
  it.each([
    ['葬送的芙莉莲 第二季', 2],
    ['Re:Zero Season 3', 3],
    ['SPY×FAMILY S2', 2],
  ])('extracts the season from %s', (title, expected) => {
    expect(extractSeasonNumber(title)).toBe(expected);
  });

  it('strips common season markers', () => {
    expect(stripSeasonToken('Re:Zero Season 3')).toBe('Re:Zero');
    expect(stripSeasonToken('间谍过家家 第二季')).toBe('间谍过家家');
  });

  it('appends a season without duplicating an existing marker', () => {
    expect(appendSeasonToTitle('药屋少女的呢喃', 2)).toBe('药屋少女的呢喃 第二季');
    expect(appendSeasonToTitle('药屋少女的呢喃 第二季', 3)).toBe('药屋少女的呢喃 第二季');
  });

  it('normalizes punctuation, spacing and letter case for matching', () => {
    expect(normalizeTitleToken(' Re:ZERO - Starting Life！')).toBe('rezerostartinglife');
  });
});
