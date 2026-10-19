import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  detail: string;
  code: string;
  errors?: unknown;
};

type ProblemInput = {
  status: number;
  code: string;
  title: string;
  detail: string;
  errors?: unknown;
};

const STATUS_META: Record<number, Omit<ProblemInput, 'status' | 'errors'>> = {
  400: { code: 'bad_request', title: 'Bad Request', detail: 'Некорректный запрос.' },
  401: { code: 'unauthorized', title: 'Unauthorized', detail: 'Требуется авторизация.' },
  403: { code: 'forbidden', title: 'Forbidden', detail: 'Доступ запрещён.' },
  404: { code: 'not_found', title: 'Not Found', detail: 'Маршрут не найден.' },
  409: { code: 'conflict', title: 'Conflict', detail: 'Конфликт данных.' },
  413: {
    code: 'payload_too_large',
    title: 'Payload Too Large',
    detail: 'Тело запроса слишком велико.',
  },
  415: {
    code: 'unsupported_media_type',
    title: 'Unsupported Media Type',
    detail: 'Неподдерживаемый тип данных.',
  },
  422: {
    code: 'validation_error',
    title: 'Unprocessable Entity',
    detail: 'Проверьте поля запроса.',
  },
  429: {
    code: 'rate_limited',
    title: 'Too Many Requests',
    detail: 'Слишком много запросов.',
  },
};

function statusMeta(status: number): Omit<ProblemInput, 'status' | 'errors'> {
  return (
    STATUS_META[status] ?? {
      code: 'request_error',
      title: 'Request Error',
      detail: 'Запрос не может быть обработан.',
    }
  );
}

function problem({ status, code, title, detail, errors }: ProblemInput): ProblemDetails {
  return {
    type: 'about:blank',
    title,
    status,
    detail,
    code,
    ...(errors === undefined ? {} : { errors }),
  };
}

function sendProblem(reply: FastifyReply, input: ProblemInput): void {
  void reply.status(input.status).type('application/problem+json').send(problem(input));
}

type AppErrorInput = {
  status: number;
  code: string;
  title: string;
  detail: string;
  errors?: unknown;
};

/**
 * Ошибка приложения с безопасным текстом для клиента.
 * Сообщение самого Error наружу не отдаётся: только detail.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly title: string;
  readonly detail: string;
  readonly errors?: unknown;

  constructor({ status, code, title, detail, errors }: AppErrorInput) {
    super(detail);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.title = title;
    this.detail = detail;
    this.errors = errors;
  }
}

export function problemNotFoundHandler(_request: FastifyRequest, reply: FastifyReply): void {
  sendProblem(reply, { status: 404, ...statusMeta(404) });
}

export function problemErrorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  if (error instanceof AppError) {
    sendProblem(reply, {
      status: error.status,
      code: error.code,
      title: error.title,
      detail: error.detail,
      errors: error.errors,
    });
    return;
  }

  const status =
    typeof error.statusCode === 'number' && error.statusCode >= 400 ? error.statusCode : 500;

  if (status >= 500) {
    request.log.error(
      { code: typeof error.code === 'string' ? error.code : 'unknown', name: error.name },
      'request failed',
    );
    sendProblem(reply, {
      status: 500,
      code: 'internal_error',
      title: 'Internal Server Error',
      detail: 'Внутренняя ошибка сервера.',
    });
    return;
  }

  sendProblem(reply, { status, ...statusMeta(status), errors: error.validation });
}
