import pino, { type DestinationStream, type Logger, type LoggerOptions } from 'pino';

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
  '*.access_token',
  '*.refresh_token',
  '*.password_hash',
  '*.newPassword',
  '*.currentPassword',
  '*.tokenHash',
  '*.token_hash',
  '*.jwtSecret',
  '*.jwt_secret',
  'jwtSecret',
  'jwt_secret',
  'passwordHash',
  'tokenHash',
  '*.secret',
  '*.*.password',
  '*.*.token',
  '*.authorization',
  '*.cookie',
  '*.email',
  '*.phone',
];

export function createLogger(
  level: string,
  pretty: boolean,
  destination?: DestinationStream,
): Logger {
  const options: LoggerOptions = {
    level,
    redact: {
      paths: REDACT_PATHS,
      censor: '[redacted]',
    },
  };

  if (destination) return pino(options, destination);

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
