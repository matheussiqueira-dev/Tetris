/**
 * API Error Module
 * Provides structured error handling for API responses.
 */

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "RATE_LIMIT_EXCEEDED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR"
  | "BAD_REQUEST"
  | "SERVICE_UNAVAILABLE";

export interface ApiErrorPayload {
  error: string;
  code: ErrorCode;
  details?: unknown;
  requestId?: string;
  retryAfterMs?: number;
}

/**
 * Custom API Error class with structured error information.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: unknown;
  readonly retryAfterMs?: number;

  constructor(
    message: string,
    status: number,
    code: ErrorCode,
    options?: { details?: unknown; retryAfterMs?: number }
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = options?.details;
    this.retryAfterMs = options?.retryAfterMs;
  }

  toPayload(requestId?: string): ApiErrorPayload {
    return {
      error: this.message,
      code: this.code,
      ...(this.details && { details: this.details }),
      ...(requestId && { requestId }),
      ...(this.retryAfterMs && { retryAfterMs: this.retryAfterMs })
    };
  }

  static badRequest(message: string, details?: unknown): ApiError {
    return new ApiError(message, 400, "BAD_REQUEST", { details });
  }

  static validationError(message: string, details?: unknown): ApiError {
    return new ApiError(message, 400, "VALIDATION_ERROR", { details });
  }

  static unauthorized(message = "Nao autorizado."): ApiError {
    return new ApiError(message, 401, "UNAUTHORIZED");
  }

  static forbidden(message = "Acesso negado."): ApiError {
    return new ApiError(message, 403, "FORBIDDEN");
  }

  static notFound(message = "Recurso nao encontrado."): ApiError {
    return new ApiError(message, 404, "NOT_FOUND");
  }

  static conflict(message: string): ApiError {
    return new ApiError(message, 409, "CONFLICT");
  }

  static rateLimitExceeded(retryAfterMs: number): ApiError {
    return new ApiError(
      "Muitas tentativas. Aguarde antes de enviar novamente.",
      429,
      "RATE_LIMIT_EXCEEDED",
      { retryAfterMs }
    );
  }

  static internalError(message = "Erro interno do servidor."): ApiError {
    return new ApiError(message, 500, "INTERNAL_ERROR");
  }

  static serviceUnavailable(message = "Servico temporariamente indisponivel."): ApiError {
    return new ApiError(message, 503, "SERVICE_UNAVAILABLE");
  }
}

/**
 * Type guard to check if an error is an ApiError.
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Converts any error to an ApiError for consistent error handling.
 */
export function toApiError(error: unknown): ApiError {
  if (isApiError(error)) {
    return error;
  }

  if (error instanceof SyntaxError && error.message.includes("JSON")) {
    return ApiError.badRequest("JSON invalido.");
  }

  if (error instanceof Error) {
    return ApiError.internalError(error.message);
  }

  return ApiError.internalError();
}
