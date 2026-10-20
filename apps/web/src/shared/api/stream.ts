import { API_BASE } from './base';
import { ApiError, toApiError } from './errors';
import { refreshSession } from './session';

type StreamEvent = {
  event: string;
  id?: string;
  data: string;
};

export type StreamOptions = {
  signal?: AbortSignal;
  onEvent: (event: StreamEvent) => void;
  onOpen?: () => void;
};

function parseStreamBlock(block: string): StreamEvent | null {
  let event = 'message';
  let id: string | undefined;
  const data: string[] = [];

  for (const line of block.split('\n')) {
    if (line === '' || line.startsWith(':')) continue;

    const separator = line.indexOf(':');
    const field = separator === -1 ? line : line.slice(0, separator);
    const rawValue = separator === -1 ? '' : line.slice(separator + 1);
    const value = rawValue.startsWith(' ') ? rawValue.slice(1) : rawValue;

    if (field === 'event') event = value;
    if (field === 'id') id = value;
    if (field === 'data') data.push(value);
  }

  if (data.length === 0) return null;

  return { event, data: data.join('\n'), ...(id ? { id } : {}) };
}

async function openStream(path: string, signal: AbortSignal | undefined, retried = false) {
  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { accept: 'text/event-stream' },
      ...(signal ? { signal } : {}),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'network_error', 'Нет связи с сервером.');
  }

  if (response.status === 401 && !retried) {
    const outcome = await refreshSession();
    if (outcome.kind === 'ok') return openStream(path, signal, true);
    if (outcome.kind === 'error') throw outcome.error;
  }

  if (!response.ok) throw await toApiError(response);

  return response;
}

/**
 * SSE через fetch, а не EventSource: поток переживает истечение access-токена
 * (single-flight refresh) и не требует заголовков поверх cookie.
 */
export async function streamRequest(
  path: string,
  { signal, onEvent, onOpen }: StreamOptions,
): Promise<void> {
  const response = await openStream(path, signal);
  const reader = response.body?.getReader();
  if (!reader) throw new ApiError(0, 'stream_unavailable', 'Поток событий недоступен.');

  onOpen?.();

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const event = parseStreamBlock(block);
        if (event) onEvent(event);
        boundary = buffer.indexOf('\n\n');
      }
    }
  } finally {
    reader.releaseLock();
  }
}
