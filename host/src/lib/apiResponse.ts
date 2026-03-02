import { NextResponse } from 'next/server';

/**
 * Standard API error response format
 */
export interface ApiErrorResponse {
  ok: false;
  error: string;
  code: number;
}

/**
 * Standard API success response format
 */
export interface ApiSuccessResponse<T = unknown> {
  ok: true;
  data?: T;
}

/**
 * Create a standardized error response
 */
export function errorResponse(error: string, code: number = 500): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    { ok: false, error, code },
    { status: code }
  );
}

/**
 * Create a standardized success response
 */
export function successResponse<T>(data?: T): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json({ ok: true, data });
}

/**
 * Common HTTP error responses
 */
export const errors = {
  badRequest: (msg = 'Bad request') => errorResponse(msg, 400),
  unauthorized: (msg = 'Unauthorized') => errorResponse(msg, 401),
  forbidden: (msg = 'Forbidden') => errorResponse(msg, 403),
  notFound: (msg = 'Not found') => errorResponse(msg, 404),
  methodNotAllowed: (msg = 'Method not allowed') => errorResponse(msg, 405),
  conflict: (msg = 'Conflict') => errorResponse(msg, 409),
  rateLimited: (msg = 'Too many requests') => errorResponse(msg, 429),
  internalError: (msg = 'Internal server error') => errorResponse(msg, 500),
  notImplemented: (msg = 'Not implemented') => errorResponse(msg, 501),
  serviceUnavailable: (msg = 'Service unavailable') => errorResponse(msg, 503),
  insufficientStorage: (msg = 'Insufficient storage') => errorResponse(msg, 507),
} as const;
