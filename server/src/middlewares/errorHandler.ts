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
  if (error instanceof SyntaxError && 'status' in error && error.status === 400) {
    response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Dữ liệu JSON không hợp lệ.' } });
    return;
  }
  const knownError = error instanceof ApiError;
  const statusCode = knownError ? error.statusCode : 500;
  const code = knownError ? error.code : 'INTERNAL_ERROR';
  const message = knownError ? error.message : 'Đã xảy ra lỗi máy chủ.';
  response.status(statusCode).json({ error: { code, message } });
};
