export type ApiSuccess<T> = {
  data: T;
  error: null;
};

export type ApiFailure = {
  error: true;
  message: string;
  code?: string;
};

export function ok<T>(data: T): ApiSuccess<T> {
  return { data, error: null };
}

export function fail(message: string, code?: string): ApiFailure {
  return code ? { error: true, message, code } : { error: true, message };
}
