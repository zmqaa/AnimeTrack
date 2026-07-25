export type QuickRecordProgressStage =
  | 'received'
  | 'parsing'
  | 'parsed'
  | 'record'
  | 'bangumi-search'
  | 'bangumi-candidates'
  | 'candidate-selection'
  | 'candidate-selected'
  | 'metadata'
  | 'saving'
  | 'cover'
  | 'record-complete'
  | 'complete';

export type QuickRecordProgressStatus = 'running' | 'success' | 'warning' | 'error' | 'info';

export type QuickRecordProgressEvent = {
  type: 'progress';
  stage: QuickRecordProgressStage;
  status: QuickRecordProgressStatus;
  message: string;
  detail?: string;
  items?: string[];
};

export type QuickRecordResultEvent<TResult = unknown> = {
  type: 'result';
  data: TResult;
};

export type QuickRecordErrorEvent = {
  type: 'error';
  error: string;
};

export type QuickRecordStreamEvent<TResult = unknown> =
  | QuickRecordProgressEvent
  | QuickRecordResultEvent<TResult>
  | QuickRecordErrorEvent;

export type QuickRecordProgressReporter = (event: QuickRecordProgressEvent) => void;
