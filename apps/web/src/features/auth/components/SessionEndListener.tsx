import { useCrossTabSessionEnd } from '../model/session';

/** Не рендерит UI: очищает кэш при выходе/истечении сессии в любой вкладке. */
export function SessionEndListener() {
  useCrossTabSessionEnd();
  return null;
}
