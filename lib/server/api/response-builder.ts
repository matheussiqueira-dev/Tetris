/**
 * API Response Builder Module
 * Provides consistent response formatting for all API endpoints.
 */

import { NextResponse } from "next/server";
import { ApiError, isApiError, toApiError, type ApiErrorPayload } from "@/lib/server/errors/api-error";
import { createRequestContext, withRequestIdHeaders, type RequestContext } from "@/lib/server/middleware/request-context";
import { createCorsHeaders, mergeHeaders } from "@/lib/server/middleware/security-headers";
import { logRequestComplete } from "@/lib/server/logger";

export interface ApiResponseMeta {
  requestId: string;
  timestamp: string;
  durationMs?: number;
}

export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta: ApiResponseMeta;
}

export interface ErrorResponse {
  success: false;
  error: ApiErrorPayload;
  meta: ApiResponseMeta;
}

/**
 * Response builder with fluent interface for creating standardized API responses.
 */
export class ResponseBuilder {
  private readonly ctx: RequestContext;
  private readonly request: Request;
  private extraHeaders: HeadersInit = {};

  constructor(request: Request) {
    this.request = request;
    this.ctx = createRequestContext(request);
  }

  get requestId(): string {
    return this.ctx.requestId;
  }

  get ip(): string {
    return this.ctx.ip;
  }

  get context(): RequestContext {
    return this.ctx;
  }

  /**
   * Adds extra headers to the response.
   */
  withHeaders(headers: HeadersInit): this {
    this.extraHeaders = mergeHeaders(this.extraHeaders, headers);
    return this;
  }

  /**
   * Returns a successful JSON response.
   */
  success<T>(data: T, status = 200): NextResponse<SuccessResponse<T>> {
    const durationMs = Date.now() - this.ctx.startTime;
    const meta: ApiResponseMeta = {
      requestId: this.ctx.requestId,
      timestamp: new Date().toISOString(),
      durationMs
    };

    logRequestComplete(this.ctx.method, this.ctx.path, status, durationMs, {
      requestId: this.ctx.requestId,
      ip: this.ctx.ip
    });

    return NextResponse.json(
      { success: true, data, meta },
      {
        status,
        headers: mergeHeaders(
          withRequestIdHeaders(this.ctx.requestId),
          createCorsHeaders(this.request),
          this.extraHeaders
        )
      }
    );
  }

  /**
   * Returns an error JSON response.
   */
  error(error: unknown): NextResponse<ErrorResponse> {
    const apiError = toApiError(error);
    const durationMs = Date.now() - this.ctx.startTime;
    const meta: ApiResponseMeta = {
      requestId: this.ctx.requestId,
      timestamp: new Date().toISOString(),
      durationMs
    };

    logRequestComplete(this.ctx.method, this.ctx.path, apiError.status, durationMs, {
      requestId: this.ctx.requestId,
      ip: this.ctx.ip,
      errorCode: apiError.code
    });

    const headers = mergeHeaders(
      withRequestIdHeaders(this.ctx.requestId),
      createCorsHeaders(this.request),
      this.extraHeaders,
      apiError.retryAfterMs
        ? { "Retry-After": String(Math.ceil(apiError.retryAfterMs / 1000)) }
        : undefined
    );

    return NextResponse.json(
      {
        success: false,
        error: apiError.toPayload(this.ctx.requestId),
        meta
      },
      { status: apiError.status, headers }
    );
  }

  /**
   * Handles OPTIONS preflight requests.
   */
  options(): NextResponse {
    return new NextResponse(null, {
      status: 204,
      headers: mergeHeaders(
        withRequestIdHeaders(this.ctx.requestId),
        createCorsHeaders(this.request)
      )
    });
  }
}

/**
 * Creates a response builder for the given request.
 */
export function createResponse(request: Request): ResponseBuilder {
  return new ResponseBuilder(request);
}
