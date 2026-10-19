import { EventEmitter } from 'node:events';
import type { Locale } from '@staynest/shared';
import type { Logger } from 'pino';
import { errorCode } from '../errors/code';

type AppEventMap = {
  'user.registered': {
    userId: string;
    locale: Locale;
    occurredAt: string;
  };
  'listing.published': {
    listingId: string;
    ownerId: string;
    occurredAt: string;
  };
};

type EventName = keyof AppEventMap;

type EventHandler<K extends EventName> = (payload: AppEventMap[K]) => void | Promise<void>;

export type EventBus = {
  publish: <K extends EventName>(name: K, payload: AppEventMap[K]) => void;
  subscribe: <K extends EventName>(name: K, handler: EventHandler<K>) => () => void;
};

/**
 * Внутренний event bus модулей. Публикация выполняется после коммита транзакции,
 * обработчик не должен ломать основной поток: ошибки логируются без message.
 */
export function createEventBus(logger: Logger): EventBus {
  const emitter = new EventEmitter();

  return {
    publish(name, payload) {
      emitter.emit(name, payload);
    },
    subscribe(name, handler) {
      const invoke = handler as (payload: unknown) => void | Promise<void>;
      const safeHandler = (payload: unknown) => {
        try {
          void Promise.resolve(invoke(payload)).catch((error: unknown) => {
            logger.error({ event: name, code: errorCode(error) }, 'event handler failed');
          });
        } catch (error) {
          logger.error({ event: name, code: errorCode(error) }, 'event handler failed');
        }
      };

      emitter.on(name, safeHandler);
      return () => {
        emitter.off(name, safeHandler);
      };
    },
  };
}
