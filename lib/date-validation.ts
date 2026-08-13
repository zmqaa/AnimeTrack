export type DateOrderIssue = {
  field: 'endDate';
  message: string;
};

type DateRange = {
  startDate?: string | null;
  endDate?: string | null;
};

function hasDate(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function getAnimeDateOrderIssue(value: DateRange): DateOrderIssue | null {
  if (hasDate(value.startDate) && hasDate(value.endDate) && value.endDate < value.startDate) {
    return { field: 'endDate', message: '看完日期不能早于开始观看日期' };
  }
  return null;
}

export function getMangaDateOrderIssue(value: DateRange): DateOrderIssue | null {
  if (hasDate(value.startDate) && hasDate(value.endDate) && value.endDate < value.startDate) {
    return { field: 'endDate', message: '读完日期不能早于开始阅读日期' };
  }
  return null;
}
