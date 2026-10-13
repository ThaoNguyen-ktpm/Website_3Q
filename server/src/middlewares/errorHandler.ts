import type { ErrorRequestHandler, RequestHandler } from 'express';

export const notFound: RequestHandler = (_request, _response, next) => {
  next(new ApiError(404, 'NOT_FOUND', 'Không tìm thấy đường dẫn.'));
};

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  const knownError = error instanceof ApiError;
  const malformedJson = error instanceof SyntaxError && 'status' in error && error.status === 400 && 'body' in error;
  const statusCode = knownError ? error.statusCode : malformedJson ? 400 : 500;
  const code = knownError ? error.code : malformedJson ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR';
  const message = knownError ? error.message : malformedJson ? 'JSON không hợp lệ.' : 'Đã xảy ra lỗi máy chủ.';
  response.status(statusCode).json({ error: { code, message } });
};
