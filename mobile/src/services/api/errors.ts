import type { ErrorEnvelope } from '@/types/api';

export const ClientErrorCode = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
} as const;

/** Friendly Mongolian copy for codes the user can actually act on. Falls back to the server message. */
const MESSAGES: Record<string, string> = {
  NETWORK_ERROR: 'Интернэт холболтоо шалгаад дахин оролдоно уу.',
  TIMEOUT: 'Сервер удаан хариу өгч байна. Дахин оролдоно уу.',
  INVALID_RESPONSE: 'Серверээс ойлгомжгүй хариу ирлээ.',
  SESSION_EXPIRED: 'Нэвтрэх хугацаа дууслаа. Дахин нэвтэрнэ үү.',
  RATE_LIMITED: 'Хэт олон оролдлого хийлээ. Түр хүлээгээд дахин оролдоно уу.',
  INTERNAL_ERROR: 'Серверт алдаа гарлаа. Түр хүлээгээд дахин оролдоно уу.',
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: ErrorEnvelope['error']['details'],
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isNetwork(): boolean {
    return this.code === ClientErrorCode.NETWORK_ERROR || this.code === ClientErrorCode.TIMEOUT;
  }

  static fromEnvelope(status: number, body: ErrorEnvelope): ApiError {
    const { code, message, details, requestId } = body.error;
    return new ApiError(status, code, MESSAGES[code] ?? message, details, requestId);
  }

  static client(code: keyof typeof ClientErrorCode): ApiError {
    return new ApiError(0, code, MESSAGES[code]);
  }
}

/** User-facing message for any thrown value. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Тодорхойгүй алдаа гарлаа. Дахин оролдоно уу.';
}
