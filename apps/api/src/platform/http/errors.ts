import type { FastifyError, FastifyPluginAsync } from 'fastify';

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

export const errorHandlingPlugin: FastifyPluginAsync = async (app) => {
  app.setNotFoundHandler((_request, reply) => {
    void reply
      .status(404)
      .type('application/problem+json')
      .send(
        problem({
          status: 404,
          code: 'not_found',
          title: 'Not Found',
          detail: 'Маршрут не найден.',
        }),
      );
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    const status =
      typeof error.statusCode === 'number' && error.statusCode >= 400 ? error.statusCode : 500;

    if (status >= 500) {
      request.log.error({ err: error }, 'request failed');
    }

    const body =
      status >= 500
        ? problem({
            status: 500,
            code: 'internal_error',
            title: 'Internal Server Error',
            detail: 'Внутренняя ошибка сервера.',
          })
        : problem({
            status,
            code: typeof error.code === 'string' ? error.code : 'request_error',
            title: error.name,
            detail: error.message,
            errors: error.validation,
          });

    void reply.status(status).type('application/problem+json').send(body);
  });
};
