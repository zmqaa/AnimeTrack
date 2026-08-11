import type { MangaReadingStatus } from './manga-shared';

type MangaStatusDateState = {
  status: MangaReadingStatus;
  startDate?: string;
  endDate?: string;
};

type MangaStatusDateInput = {
  status?: MangaReadingStatus;
  startDate?: string | null;
  endDate?: string | null;
};

export function buildMangaStatusDatePatch(
  before: MangaStatusDateState,
  input: MangaStatusDateInput,
  today: string,
) {
  const patch: { startDate?: string; endDate?: string | null } = {};
  const nextStatus = input.status || before.status;

  if (['reading', 'caught_up', 'completed'].includes(nextStatus) && !before.startDate && !input.startDate) {
    patch.startDate = today;
  }
  if (nextStatus === 'completed' && !before.endDate && !input.endDate) {
    patch.endDate = today;
  }
  if (before.status === 'completed' && nextStatus !== 'completed' && input.endDate === undefined) {
    patch.endDate = null;
  }

  return patch;
}
