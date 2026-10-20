import type { QueryClient } from '@tanstack/react-query';
import { detachCurrentDevicePush } from '../../notifications';
import { clearPrivateClientData } from '../../pwa';
import { queryKeys } from '../../../shared/api';
import { forgetSessionOwner, notifySessionEnded } from './session';

type SessionCleanupOptions = {
  /** Push уже отписан до вызова (например, перед logout). */
  detachPush?: boolean;
};

/**
 * Единая точка завершения сессии на клиенте: logout, смена пароля,
 * истечение refresh-токена и вход другим пользователем в том же браузере.
 * Ошибки локальной очистки не должны отменять уже завершённую сервером сессию.
 */
export async function endSessionLocally(
  queryClient: QueryClient,
  { detachPush = true }: SessionCleanupOptions = {},
): Promise<void> {
  await queryClient.cancelQueries();
  queryClient.setQueryData(queryKeys.me, null);
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== queryKeys.me[0] });

  if (detachPush) await detachCurrentDevicePush().catch(() => undefined);

  await clearPrivateClientData().catch(() => undefined);
  forgetSessionOwner();
  notifySessionEnded();
}
