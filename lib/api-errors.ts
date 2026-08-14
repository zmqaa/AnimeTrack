export const API_ERROR_STATUS = {
  BAD_REQUEST: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  UPSTREAM_ERROR: 502,
  SERVICE_UNAVAILABLE: 503,
  UPSTREAM_TIMEOUT: 504,
} as const;

export type ApiErrorCode = keyof typeof API_ERROR_STATUS;
export type ApiServerErrorCode = Extract<
  ApiErrorCode,
  'INTERNAL_ERROR' | 'UPSTREAM_ERROR' | 'SERVICE_UNAVAILABLE' | 'UPSTREAM_TIMEOUT'
>;

export type ApiErrorPayload = {
  error: string;
  code: ApiErrorCode;
} & Record<string, unknown>;

export function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === 'string' && value in API_ERROR_STATUS;
}

/** 可安全返回给浏览器的预期 API 错误。未预期异常不要使用此类型包装。 */
export class ApiRouteError extends Error {
  readonly status: number;

  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiRouteError';
    this.status = API_ERROR_STATUS[code];
  }
}
