type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

type Listener = (available: boolean) => void;

let deferredPrompt: InstallPromptEvent | null = null;
let initialized = false;
const listeners = new Set<Listener>();

function notify(available: boolean): void {
  for (const listener of listeners) listener(available);
}

/**
 * Вызывается один раз до рендера: `beforeinstallprompt` может сработать
 * раньше, чем смонтируется React-дерево.
 */
export function initInstallPrompt(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as InstallPromptEvent;
    notify(true);
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify(false);
  });
}

export function subscribeInstallPrompt(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function canPromptInstall(): boolean {
  return deferredPrompt !== null;
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const event = deferredPrompt;
  if (!event) return 'unavailable';

  await event.prompt();
  const choice = await event.userChoice;

  // Chrome разрешает использовать событие один раз.
  deferredPrompt = null;
  notify(false);
  return choice.outcome;
}
