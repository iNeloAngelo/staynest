import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { Logger } from 'pino';
import { errorCode } from '../errors/code';
import type { MailConfig } from '../config/index';

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Имя шаблона для логов; получатель и тело письма не логируются. */
  tag: string;
};

export type Mailer = {
  send: (message: MailMessage) => Promise<void>;
  close: () => void;
};

function createTransport(config: MailConfig): Transporter {
  const auth =
    config.user && config.password ? { user: config.user, pass: config.password } : undefined;

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: false,
    auth,
    connectionTimeout: 5_000,
    greetingTimeout: 5_000,
    socketTimeout: 10_000,
  });
}

export function createMailer(config: MailConfig, logger: Logger): Mailer {
  const transport = createTransport(config);

  return {
    async send(message) {
      try {
        const info = await transport.sendMail({
          from: config.from,
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
        });
        logger.info({ tag: message.tag, messageId: info.messageId }, 'mail sent');
      } catch (error) {
        logger.warn({ tag: message.tag, code: errorCode(error) }, 'mail send failed');
        throw error;
      }
    },
    close() {
      transport.close();
    },
  };
}

/** Заглушка для тестов и сценариев без SMTP: письма никуда не уходят. */
export function createNoopMailer(logger: Logger): Mailer {
  return {
    async send(message) {
      logger.debug({ tag: message.tag }, 'mail skipped (noop transport)');
    },
    close() {
      return undefined;
    },
  };
}
