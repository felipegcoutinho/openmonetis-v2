export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: 400 | 401 | 403 | 404 | 409 | 503,
  ) {
    super(message);
  }
}

export function notFound(message: string, code: string) {
  return new ApiError(message, code, 404);
}

export function badRequest(message: string, code: string) {
  return new ApiError(message, code, 400);
}

export function conflict(message: string, code: string) {
  return new ApiError(message, code, 409);
}

export function serviceUnavailable(message: string, code: string) {
  return new ApiError(message, code, 503);
}
