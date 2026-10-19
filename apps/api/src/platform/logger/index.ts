import pino, { type Logger, type LoggerOptions } from 'pino';

const REDACT_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'res.headers["set-cookie"]',
  'req.body.password',
  'req.body.email',
  'req.body.token',
  '*.password',
  '*.passwordHash',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.secret',
  '*.authorization',
  '*.cookie',
  '*.email',
  '*.phone',
];

export function createLogger(level: string, pretty: boolean): Logger {
  const options: LoggerOptions = {
    level,
    redact: {
      paths: REDACT_PATHS,
      censor: '[redacted]',
    },
  };

  if (pretty) {
    options.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    };
  }

  return pino(options);
}
