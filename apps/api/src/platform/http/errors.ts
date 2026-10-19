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
  headers?: Record<string, string>;
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
  for (const [name, value] of Object.entries(input.headers ?? {})) {
    reply.header(name, value);
  }

  void reply
    .header('cache-control', 'no-store')
    .status(input.status)
    .type('application/problem+json')
    .send(problem(input));
}

function logServerError(request: FastifyRequest, error: FastifyError): void {
  request.log.error(
    {
      code: typeof error.code === 'string' ? error.code : 'unknown',
      name: error.name,
      // Первая строка стека содержит message, её не логируем: там могут быть DSN/SQL/PII.
      stack: error.stack?.split('\n').slice(1).join('\n'),
    },
    'request failed',
  );
}

type AppErrorInput = {
  status: number;
  code: string;
  title: string;
  detail: string;
  errors?: unknown;
  headers?: Record<string, string>;
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
  readonly headers?: Record<string, string>;

  constructor({ status, code, title, detail, errors, headers }: AppErrorInput) {
    if (status < 400 || status > 599) {
      throw new Error('AppError.status должен быть в диапазоне 400–599');
    }

    super(detail);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.title = title;
    this.detail = detail;
    this.errors = errors;
    this.headers = headers;
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
  if (error instanceof AppError && error.status < 500) {
    sendProblem(reply, {
      status: error.status,
      code: error.code,
      title: error.title,
      detail: error.detail,
      errors: error.errors,
      headers: error.headers,
    });
    return;
  }

  const status =
    typeof error.statusCode === 'number' && error.statusCode >= 400 ? error.statusCode : 500;

  if (status >= 500) {
    logServerError(request, error);
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
